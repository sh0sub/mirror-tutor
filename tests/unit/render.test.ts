import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderLesson, type StepResult } from "@/lib/services/render";
import { analyzeFace } from "@/lib/services/analyze";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { buildVtoRequest, extractResultUrl, validateEffect } from "@/lib/youcam/makeupVto";
import { POST } from "@/app/api/render/route";
import type { FaceProfile } from "@/lib/profile";
import { buildLesson } from "@/lib/lessons";
import liveBodies from "../../fixtures/youcam/live/makeup-vto.success-bodies.json";
import { syntheticSelfie } from "../helpers";

const fast = { sleep: async () => {} };
const profile: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };
afterEach(() => setRuntime(undefined));

async function collect(fn: (on: (r: StepResult) => void) => Promise<unknown>) {
  const out: StepResult[] = [];
  const summary = await fn((r) => out.push(r));
  return { out, summary };
}

describe("Makeup VTO request helpers", () => {
  it("builds the documented body and reads both documented result shapes", () => {
    expect(buildVtoRequest("f", [])).toEqual({ src_file_id: "f", effects: [], version: "1.0" });
    expect(extractResultUrl({ url: "u1" })).toBe("u1");
    expect(extractResultUrl([{ download_url: "u2" }])).toBe("u2");
    expect(() => extractResultUrl({})).toThrow();
  });

  it("validator enforces catalog labels, colorNum and texture-specific required fields", () => {
    expect(validateEffect({ category: "eye_shadow", pattern: { name: "2colors1" }, palettes: [{ color: "#111111" }] })[0]).toMatch(/needs 2 palettes/);
    expect(validateEffect({ category: "blush", pattern: { name: "nope" }, palettes: [{ color: "#111111" }] })[0]).toMatch(/not a catalog label/);
    expect(validateEffect({ category: "lip_color", palettes: [{ color: "#111111", texture: "gloss" }] })).toEqual([
      "lip_color.palettes[0].gloss required for texture gloss",
      "lip_color.palettes[0].transparencyIntensity required for texture gloss",
    ]);
    expect(validateEffect({ category: "foundation", palettes: [{ color: "red" }] })[0]).toMatch(/#RRGGBB/);
  });

  it("builds exactly the 4 cumulative bodies that returned success on the live API (daily-k, monolid)", () => {
    const plan = buildLesson(liveBodies.lesson, liveBodies.profile as FaceProfile);
    expect(plan.steps.map((s) => buildVtoRequest("[redacted]", s.cumulativeEffects))).toEqual(liveBodies.steps.map((s) => s.body));
    for (const s of plan.steps) expect(s.cumulativeEffects.flatMap(validateEffect)).toEqual([]);
    const brow = plan.steps[1].effects[0];
    expect(brow.pattern).toEqual({ type: "shape", name: "Straight1", curvature: 0, thickness: 0, definition: 50 });
    const lip = plan.steps[3].effects[0];
    expect(lip.style).toEqual({ type: "ombre", innerColorRatio: 40, blendStrength: 60 });
    expect(lip.palettes).toHaveLength(2);
  });

  it("rejects the bodies the live API answered with invalid_parameter", () => {
    // step 2: "effects.eyebrows.pattern.curvature/definition/thickness is required"
    expect(validateEffect({ category: "eyebrows", pattern: { type: "shape", name: "Straight1" }, palettes: [{ color: "#6B4A3A", colorIntensity: 55, texture: "matte" }] })).toEqual([
      "eyebrows: pattern.curvature required (-100..100)",
      "eyebrows: pattern.thickness required (-100..100)",
      "eyebrows: pattern.definition required (0..100)",
    ]);
    // step 4: "palettes length is insufficient; style.blendStrength / innerColorRatio is required"
    const oldLip = {
      category: "lip_color",
      shape: { name: "original" },
      style: { type: "ombre", innerRatio: 40, featherStrength: 60 },
      palettes: [{ color: "#C94F5E", colorIntensity: 45, texture: "gloss", gloss: 60, transparencyIntensity: 30 }],
    };
    expect(validateEffect(oldLip)).toEqual([
      "lip_color: ombre needs innerColorRatio 0..100",
      "lip_color: ombre needs blendStrength 0..100",
      "lip_color: ombre needs 2 palettes (outer, inner)",
    ]);
    // probe: blush 1color1 with 2 palettes → invalid_parameter
    expect(validateEffect({ category: "blush", pattern: { name: "1color1" }, palettes: [{ color: "#E79A9A" }, { color: "#D06060" }] })[0]).toMatch(/needs 1 palettes/);
  });
});

describe("renderLesson (F4)", () => {
  it("renders 4 steps in parallel on the analyze file_id (no re-upload), 1u each, then serves the cache at 0u", async () => {
    const t = createMockTransport({ runningPolls: 1 });
    const rt = createRuntime(readConfig({}), t);
    const img = await syntheticSelfie();
    await analyzeFace(rt, "s", img, fast);

    const first = await collect((on) => renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile }, on, fast));
    expect(first.out.map((r) => r.status)).toEqual(["done", "done", "done", "done"]);
    expect(first.summary).toMatchObject({ mode: "mock", spent: 4, units: { sessionSpent: 14 } });
    expect(t.calls.createFile).toBe(1); // reused analyze upload
    expect(t.calls.runTask["makeup-vto"]).toBe(4);
    const done = first.out[0];
    if (done.status === "done") {
      expect(done.image.startsWith("data:image/jpeg;base64,")).toBe(true);
      const meta = await sharp(Buffer.from(done.image.split(",")[1], "base64")).metadata();
      expect(meta.width).toBe(600);
    }

    const second = await collect((on) => renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile }, on, fast));
    expect(second.out.every((r) => r.status === "done" && r.cached)).toBe(true);
    expect(second.summary).toMatchObject({ spent: 0 });
    expect(t.calls.runTask["makeup-vto"]).toBe(4);
  });

  it("flow B: uploads once when there is no analyze upload for this image", async () => {
    const t = createMockTransport({ render: async (s) => s });
    const rt = createRuntime(readConfig({}), t);
    await collect(async (on) => renderLesson(rt, "s", { image: await syntheticSelfie(), lessonId: "shading", profile }, on, fast));
    expect(t.calls.createFile).toBe(1);
    expect(t.calls.runTask["makeup-vto"]).toBe(4);
  });

  it("partial completion: a failed step reports an error (not charged) while the others finish", async () => {
    const t = createMockTransport({ failVtoCategory: "lip_color", render: async (s) => s });
    const rt = createRuntime(readConfig({}), t);
    const { out, summary } = await collect(async (on) => renderLesson(rt, "s", { image: await syntheticSelfie(), lessonId: "daily-k", profile }, on, fast));
    const byIndex = Object.fromEntries(out.map((r) => [r.index, r.status]));
    expect(byIndex).toEqual({ 1: "done", 2: "done", 3: "done", 4: "error" });
    expect(summary).toMatchObject({ spent: 3 });
  });

  it("retries a single step (steps=[4]) for 1 unit", async () => {
    const t = createMockTransport({ render: async (s) => s });
    const rt = createRuntime(readConfig({}), t);
    await expect(renderLesson(rt, "s", { image: new Uint8Array(), lessonId: "daily-k", profile, steps: [4] }, () => {}, fast)).rejects.toThrow();
    expect((await rt.guard.status("s")).sessionSpent).toBe(0);
    const img = await syntheticSelfie();
    const r2 = await collect((on) => renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile, steps: [4] }, on, fast));
    expect(r2.out.map((r) => r.index)).toEqual([4]);
    expect(r2.summary).toMatchObject({ spent: 1 });
  });

  it("blocks steps beyond the session cap instead of overspending", async () => {
    const t = createMockTransport({ render: async (s) => s });
    const rt = createRuntime(readConfig({ SESSION_UNIT_CAP: "12" }), t);
    const img = await syntheticSelfie();
    await analyzeFace(rt, "s", img, fast);
    const { out, summary } = await collect((on) => renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile }, on, fast));
    expect(out.filter((r) => r.status === "done")).toHaveLength(2);
    expect(out.filter((r) => r.status === "blocked")).toHaveLength(2);
    expect(summary).toMatchObject({ units: { sessionSpent: 12 } });
  });

  it("demo mode (<150u) renders the sample model locally and calls no API", async () => {
    const t = createMockTransport({ credit: 120 });
    const rt = createRuntime(readConfig({}), t);
    const { out, summary } = await collect(async (on) => renderLesson(rt, "s", { image: await syntheticSelfie(), lessonId: "daily-k", profile }, on, fast));
    expect(summary).toMatchObject({ mode: "demo", spent: 0 });
    expect(out.filter((r) => r.status === "done")).toHaveLength(4);
    expect(t.calls.createFile).toBe(0);
  });
});

describe("POST /api/render (NDJSON stream)", () => {
  it("streams one line per step and a done line, without exposing result URLs", async () => {
    setRuntime(createRuntime(readConfig({}), createMockTransport({ render: async (s) => s, runningPolls: 0 })));
    const form = new FormData();
    form.set("image", new Blob([await syntheticSelfie()], { type: "image/jpeg" }));
    form.set("lessonId", "gradient-lip");
    form.set("profile", JSON.stringify(profile));
    const res = await POST(new Request("http://x/api/render", { method: "POST", body: form }));
    expect(res.headers.get("content-type")).toMatch(/ndjson/);
    const text = await res.text();
    expect(text).not.toMatch(/mock:\/\/|https?:\/\//);
    const lines = text.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === "step")).toHaveLength(4);
    expect(lines.at(-1)).toMatchObject({ type: "done", spent: 4 });
  });

  it("rejects a bad profile", async () => {
    setRuntime(createRuntime(readConfig({}), createMockTransport()));
    const form = new FormData();
    form.set("image", new Blob([new Uint8Array([1])]));
    form.set("lessonId", "daily-k");
    form.set("profile", JSON.stringify({ eyelid: "x" }));
    const res = await POST(new Request("http://x/api/render", { method: "POST", body: form }));
    expect(res.status).toBe(400);
  });
});
