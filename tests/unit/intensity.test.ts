import { afterEach, describe, expect, it } from "vitest";
import { renderLesson, type StepResult } from "@/lib/services/render";
import { analyzeFace } from "@/lib/services/analyze";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { renderCacheKey } from "@/lib/cache";
import { buildLesson, parseStepScales } from "@/lib/lessons";
import { validateEffect } from "@/lib/youcam/makeupVto";
import { POST } from "@/app/api/render/route";
import type { FaceProfile } from "@/lib/profile";
import { syntheticSelfie } from "../helpers";

const fast = { sleep: async () => {} };
const profile: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };
afterEach(() => setRuntime(undefined));

const intensities = (effects: { palettes?: Array<{ colorIntensity?: number }> }[]) => effects.flatMap((e) => (e.palettes ?? []).map((p) => p.colorIntensity));

describe("S4 lesson difficulty (#20): per-step −20% / +20%", () => {
  it("scales only the chosen step's own effects; later cumulative steps carry it; still valid VTO bodies", () => {
    const base = buildLesson("daily-k", profile);
    const strong = buildLesson("daily-k", profile, { stepScales: { 3: 1.2 } });
    const light = buildLesson("daily-k", profile, { stepScales: { 3: 0.8 } });
    expect(intensities(strong.steps[1].effects)).toEqual(intensities(base.steps[1].effects)); // step 2 untouched
    const b3 = intensities(base.steps[2].effects) as number[];
    const s3 = intensities(strong.steps[2].effects) as number[];
    const l3 = intensities(light.steps[2].effects) as number[];
    b3.forEach((v, i) => {
      expect(s3[i]).toBe(Math.min(100, Math.round(v * 1.2)));
      expect(l3[i]).toBe(Math.round(v * 0.8));
    });
    // step 4 renders effects[1..4]; its copy of step 3's effects is the scaled one
    expect(JSON.stringify(strong.steps[3].cumulativeEffects)).toContain(JSON.stringify(strong.steps[2].effects[0]));
    for (const p of [strong, light]) for (const s of p.steps) expect(s.cumulativeEffects.flatMap(validateEffect)).toEqual([]);
  });

  it("parses only known steps and allowed scales from the client", () => {
    expect(parseStepScales({ 2: 1.2, 3: 0.8 })).toEqual({ 2: 1.2, 3: 0.8 });
    expect(parseStepScales({ 2: 1, 5: 1.2, 0: 0.8, x: 1.2, 3: 2, 4: "1.2" })).toEqual({});
    expect(parseStepScales(null)).toEqual({});
    expect(parseStepScales([1.2])).toEqual({});
  });

  it("re-renders one step for 1u under a new cache key; the same choice again is a 0u cache hit", async () => {
    const t = createMockTransport({ render: async (s) => s });
    const rt = createRuntime(readConfig({}), t);
    const img = await syntheticSelfie();
    await analyzeFace(rt, "s", img, fast); // 10u
    await renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile }, () => {}, fast); // 4u

    const out: StepResult[] = [];
    const r1 = await renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile, steps: [2], build: { stepScales: { 2: 1.2 } } }, (r) => out.push(r), fast);
    expect(out).toMatchObject([{ index: 2, status: "done", cached: false }]);
    expect(r1).toMatchObject({ spent: 1, units: { sessionSpent: 15 } });
    expect(t.calls.runTask["makeup-vto"]).toBe(5);

    const keyBase = renderCacheKey("h", buildLesson("daily-k", profile).steps[1].cumulativeEffects);
    const keyStrong = renderCacheKey("h", buildLesson("daily-k", profile, { stepScales: { 2: 1.2 } }).steps[1].cumulativeEffects);
    expect(keyStrong).not.toBe(keyBase);

    const again: StepResult[] = [];
    const r2 = await renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile, steps: [2], build: { stepScales: { 2: 1.2 } } }, (r) => again.push(r), fast);
    expect(again).toMatchObject([{ index: 2, status: "done", cached: true }]);
    expect(r2).toMatchObject({ spent: 0 });
    // back to base: original render still cached → 0u
    const back = await renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile, steps: [2] }, () => {}, fast);
    expect(back).toMatchObject({ spent: 0 });
    expect(t.calls.runTask["makeup-vto"]).toBe(5);
  });

  it("respects the session 20u cap (blocked, not charged)", async () => {
    const t = createMockTransport({ render: async (s) => s });
    const rt = createRuntime(readConfig({ SESSION_UNIT_CAP: "14" }), t);
    const img = await syntheticSelfie();
    await analyzeFace(rt, "s", img, fast);
    await renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile }, () => {}, fast); // 14u = cap
    const out: StepResult[] = [];
    const r = await renderLesson(rt, "s", { image: img, lessonId: "daily-k", profile, steps: [3], build: { stepScales: { 3: 0.8 } } }, (x) => out.push(x), fast);
    expect(out).toMatchObject([{ index: 3, status: "blocked", code: "session_cap" }]);
    expect(r).toMatchObject({ spent: 0, units: { sessionSpent: 14 } });
  });

  it("POST /api/render forwards stepScales", async () => {
    const t = createMockTransport({ render: async (s) => s, runningPolls: 0 });
    setRuntime(createRuntime(readConfig({}), t));
    const form = new FormData();
    form.set("image", new Blob([await syntheticSelfie()], { type: "image/jpeg" }));
    form.set("lessonId", "daily-k");
    form.set("profile", JSON.stringify(profile));
    form.set("steps", "4");
    form.set("stepScales", JSON.stringify({ 4: 0.8 }));
    const lines = (await (await POST(new Request("http://x/api/render", { method: "POST", body: form }))).text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === "step")).toHaveLength(1);
    expect(lines.at(-1)).toMatchObject({ type: "done", spent: 1 });
  });
});
