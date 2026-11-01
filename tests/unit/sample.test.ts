import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import type { YouCamTransport } from "@/lib/youcam/client";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as renderPOST } from "@/app/api/render/route";
import { analyzeSample, isPregenerated, renderSample, SAMPLE_ATTEMPT, SAMPLE_LESSON, SAMPLE_MODEL } from "@/lib/services/sample";
import { analyzedProfile, sampleAttemptFor, sampleOwnAttempt, sampleRecommendation, sampleModelById, SAMPLE_ATTEMPTS, SAMPLE_GRADES, SAMPLE_SCORE } from "@/lib/demo/sample";
import { pregeneratedSteps } from "@/lib/services/sample";
import { recommendLesson } from "@/lib/lessons";
import { buildLesson } from "@/lib/lessons";
import { existsSync } from "node:fs";
import path from "node:path";
import type { StepResult } from "@/lib/services/render";
import { PRODUCTS } from "@/lib/shop";
import { ProductArt, productArtKind } from "@/components/ProductArt";
import { syntheticSelfie } from "../helpers";

/** A transport that records every call and fails it — the sample path must never reach it. */
function trapTransport(kind: "live" | "mock" = "live") {
  const calls: string[] = [];
  const trap = (name: string) => async () => {
    calls.push(name);
    throw new Error(`YouCam ${name} must not be called from the sample path`);
  };
  const t: YouCamTransport = {
    kind,
    createFile: trap("createFile"),
    putUpload: trap("putUpload"),
    runTask: trap("runTask"),
    getTask: trap("getTask"),
    getCredit: trap("getCredit"),
    getFeatureCost: trap("getFeatureCost"),
    download: trap("download"),
  };
  return { t, calls };
}

function installTrap() {
  const { t, calls } = trapTransport();
  const rt = createRuntime(readConfig({ YOUCAM_MODE: "live", YOUCAM_API_KEY: "test-not-a-real-key" }), t);
  setRuntime(rt);
  return { rt, calls };
}

async function readNdjson(res: Response) {
  return (await res.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as { type: string } & Record<string, unknown>);
}

afterEach(() => setRuntime(undefined));

describe("sample model (chosen by the visitor, 0 units)", () => {
  it("plays back Model A's pre-generated profile with 0 units", () => {
    const r = analyzeSample(20);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("sample");
    expect(r.profile).toEqual(SAMPLE_MODEL.profile);
    expect(r.recommendation.lessonId).toBe(SAMPLE_LESSON);
    expect(r.units.spent).toBe(0);
    expect(SAMPLE_ATTEMPT).toBe("/demo/model-a/sample-attempt.jpg");
    expect(SAMPLE_SCORE).toBe(79); // one sample score on the grade, share and home scenes (video + docs quote it)
  });

  it("POST /api/analyze sample=1 needs no image and never touches the YouCam transport (even in live mode)", async () => {
    const { rt, calls } = installTrap();
    expect(rt.transport.kind).toBe("live");
    const form = new FormData();
    form.set("sample", "1");
    const res = await analyzePOST(new Request("http://x/api/analyze", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, mode: "sample", profile: SAMPLE_MODEL.profile, units: { spent: 0 } });
    expect(calls).toEqual([]);
  });

  it("POST /api/analyze sample=1 ignores an attached image (no upload, no Face Analyzer)", async () => {
    const { calls } = installTrap();
    const form = new FormData();
    form.set("sample", "1");
    form.set("image", new Blob([new Uint8Array(await syntheticSelfie())], { type: "image/jpeg" }), "selfie.jpg");
    const res = await analyzePOST(new Request("http://x/api/analyze", { method: "POST", body: form }));
    expect((await res.json()).mode).toBe("sample");
    expect(calls).toEqual([]);
  });

  it("POST /api/render sample=1 streams the 4 pre-generated YouCam steps at 0 units, no transport call", async () => {
    const { calls } = installTrap();
    const form = new FormData();
    form.set("sample", "1");
    form.set("lessonId", SAMPLE_LESSON);
    form.set("profile", JSON.stringify(SAMPLE_MODEL.profile));
    form.set("skinShade", "23N"); // ignored for the sample (not the visitor's face)
    const events = await readNdjson(await renderPOST(new Request("http://x/api/render", { method: "POST", body: form })));
    const steps = events.filter((e) => e.type === "step") as unknown as StepResult[];
    expect(steps.map((s) => s.index).sort()).toEqual([1, 2, 3, 4]);
    for (const s of steps) {
      expect(s.status).toBe("done");
      if (s.status === "done") expect(s.image).toBe(SAMPLE_MODEL.steps[s.index - 1]);
    }
    expect(events.at(-1)).toMatchObject({ type: "done", mode: "sample", spent: 0 });
    expect(calls).toEqual([]);
  });

  it("an edited profile or ±20% intensity falls back to the local preview on Model A — still 0 units, no transport call", async () => {
    const { calls } = installTrap();
    const out: StepResult[] = [];
    const summary = await renderSample({ lessonId: SAMPLE_LESSON, profile: { ...SAMPLE_MODEL.profile, eyelid: "monolid" }, steps: [2] }, (r) => out.push(r), 20);
    expect(summary).toMatchObject({ mode: "sample", spent: 0 });
    expect(out).toHaveLength(1);
    expect(out[0].status === "done" && out[0].image.startsWith("data:image/jpeg;base64,")).toBe(true);

    const form = new FormData();
    form.set("sample", "1");
    form.set("lessonId", SAMPLE_LESSON);
    form.set("profile", JSON.stringify(SAMPLE_MODEL.profile));
    form.set("steps", "3");
    form.set("stepScales", JSON.stringify({ 3: 1.2 }));
    const events = await readNdjson(await renderPOST(new Request("http://x/api/render", { method: "POST", body: form })));
    expect(events.filter((e) => e.type === "step")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "done", mode: "sample", spent: 0 });
    expect(calls).toEqual([]);
  });

  it("only the exact pre-generated request is served from the stored YouCam results", () => {
    expect(isPregenerated(SAMPLE_LESSON, SAMPLE_MODEL.profile)).toBe(true);
    expect(isPregenerated(SAMPLE_LESSON, SAMPLE_MODEL.profile, { stepScales: {} })).toBe(true);
    expect(isPregenerated(SAMPLE_LESSON, SAMPLE_MODEL.profile, { stepScales: { 2: 0.8 } })).toBe(false);
    expect(isPregenerated(SAMPLE_LESSON, SAMPLE_MODEL.profile, { skinShade: "21N" })).toBe(false);
    expect(isPregenerated("shading", SAMPLE_MODEL.profile)).toBe(false);
    expect(isPregenerated(SAMPLE_LESSON, { ...SAMPLE_MODEL.profile, lipShape: "thin" })).toBe(false);
  });

  it("without sample=1 the render route still requires an image", async () => {
    installTrap();
    const form = new FormData();
    form.set("lessonId", SAMPLE_LESSON);
    form.set("profile", JSON.stringify(SAMPLE_MODEL.profile));
    const res = await renderPOST(new Request("http://x/api/render", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("missing_image");
  });
});

describe("Shop-the-step product art", () => {
  it("every catalog category has its own illustration (no plain-swatch fallback)", () => {
    for (const p of PRODUCTS) expect(productArtKind(p.category), p.sku).not.toBe("swatch");
    expect(productArtKind("unknown")).toBe("swatch");
  });

  it("is an inline SVG tinted with the product's own shades — no external images or brand text", () => {
    for (const p of PRODUCTS) {
      const svg = renderToStaticMarkup(createElement(ProductArt, { category: p.category, shades: p.shades, texture: p.texture }));
      expect(svg.startsWith("<svg")).toBe(true);
      for (const h of p.shades) expect(svg, p.sku).toContain(h);
      expect(svg).not.toMatch(/<image|<img|https?:|<text/);
    }
  });
});

describe("C11 monolid sample: analyzer misread, visitor correction, lesson switch (0 units)", () => {
  const mono = sampleModelById("model-c");

  it("the monolid sample is analyzed as Double-lid (the analyzer's raw reading); the correction is the visitor's", () => {
    const r = analyzeSample(20, "model-c");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("sample");
    expect(r.profile.eyelid).toBe("double");
    expect(r.profile).toEqual(analyzedProfile("model-c"));
    expect(r.source.eyelid).toBe("Double-lid / Double-lid");
    expect(r.units.spent).toBe(0);
    expect(mono.profile.eyelid).toBe("monolid");
    expect(mono.edited).toEqual(["eyelid"]);
    // the default sample is unchanged
    const a = analyzeSample(20);
    expect(a.ok && a.profile).toEqual(SAMPLE_MODEL.profile);
  });

  it("the edit to Monolid switches the lesson: corrected profile plays the pre-generated horizontal-gradient steps, the raw reading plays its own", () => {
    const raw = analyzedProfile("model-c");
    expect(pregeneratedSteps(SAMPLE_LESSON, mono.profile, undefined, "model-c")).toEqual(mono.steps);
    expect(pregeneratedSteps(SAMPLE_LESSON, raw, undefined, "model-c")).toEqual(mono.rawSteps);
    expect(mono.rawSteps).toHaveLength(4);
    expect(mono.rawSteps).not.toEqual(mono.steps);
    expect(pregeneratedSteps(SAMPLE_LESSON, { ...mono.profile, lipShape: "thin" }, undefined, "model-c")).toBeNull();
    expect(pregeneratedSteps(SAMPLE_LESSON, mono.profile, { stepScales: { 3: 1.2 } }, "model-c")).toBeNull();
    expect(pregeneratedSteps(SAMPLE_LESSON, mono.profile, undefined, "model-a")).toBeNull(); // not model-a's profile
    // the lesson text itself switches: step 3 shadow pattern differs between the two readings
    const shadow = (p: typeof raw) => buildLesson(SAMPLE_LESSON, p).steps[2].effects.find((e) => e.category === "eye_shadow")?.pattern?.name;
    expect(shadow(raw)).not.toBe(shadow(mono.profile));
    // the correction also changes which lesson is recommended
    expect(recommendLesson(mono.profile).lessonId).toBe(SAMPLE_LESSON);
  });

  it("POST /api/analyze + /api/render with sampleId=model-c: 0 YouCam calls, corrected steps, raw steps", async () => {
    const { calls } = installTrap();
    const form = new FormData();
    form.set("sample", "1");
    form.set("sampleId", "model-c");
    const body = await (await analyzePOST(new Request("http://x/api/analyze", { method: "POST", body: form }))).json();
    expect(body).toMatchObject({ ok: true, mode: "sample", units: { spent: 0 } });
    expect(body.profile.eyelid).toBe("double");
    for (const [profile, expected] of [
      [mono.profile, mono.steps],
      [analyzedProfile("model-c"), mono.rawSteps!],
    ] as const) {
      const f = new FormData();
      f.set("sample", "1");
      f.set("sampleId", "model-c");
      f.set("lessonId", SAMPLE_LESSON);
      f.set("profile", JSON.stringify(profile));
      const events = await readNdjson(await renderPOST(new Request("http://x/api/render", { method: "POST", body: f })));
      const steps = events.filter((e) => e.type === "step") as unknown as StepResult[];
      expect(steps.map((s) => (s.status === "done" ? s.image : null)).sort()).toEqual([...expected].sort());
      expect(events.at(-1)).toMatchObject({ type: "done", mode: "sample", spent: 0 });
    }
    expect(calls).toEqual([]);
  });

  it("an unknown sampleId falls back to the default double-lid sample", async () => {
    installTrap();
    const form = new FormData();
    form.set("sample", "1");
    form.set("sampleId", "../../etc/passwd");
    const body = await (await analyzePOST(new Request("http://x/api/analyze", { method: "POST", body: form }))).json();
    expect(body.profile).toEqual(SAMPLE_MODEL.profile);
  });

  it("a local-preview fallback on the monolid sample draws on the monolid photo (0 units)", async () => {
    const { calls } = installTrap();
    const out: StepResult[] = [];
    await renderSample({ lessonId: SAMPLE_LESSON, profile: { ...mono.profile, lipShape: "thin" }, steps: [1], sampleId: "model-c" }, (r) => out.push(r), 20);
    expect(out[0].status === "done" && out[0].image.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe("C11 precomputed sample grades (result in under a second, same landmark grader)", () => {
  it("every pre-generated final answer has a simulated attempt photo and a stored grade with score-label points", () => {
    const answers = [SAMPLE_MODEL.steps[3], sampleModelById("model-c").steps[3], sampleModelById("model-c").rawSteps![3]];
    for (const a of answers) {
      const attempt = sampleAttemptFor(a)!;
      expect(attempt, a).toBeTruthy();
      expect(existsSync(path.join(process.cwd(), "public", attempt)), attempt).toBe(true);
      const g = SAMPLE_GRADES[attempt];
      expect(g, attempt).toBeDefined();
      expect(g.grade).toMatchObject({ comparable: true, grader: "landmark", units: 0 });
      expect(g.grade.regions.map((r) => r.region).sort()).toEqual(["cheek", "eye_lid", "eye_line", "lip"]);
      expect(Math.abs(g.grade.total! - SAMPLE_SCORE)).toBeLessThanOrEqual(2); // all sample variants read about 79
      for (const r of g.grade.regions) {
        expect(r.score).toBeLessThan(97); // visibly off-shade, no scripted 100s
        expect(r.answerHex).toMatch(/^#[0-9A-F]{6}$/);
      }
      expect(g.grade.regions.find((r) => r.region === "lip")!.score).toBeLessThan(70);
      expect(Object.keys(g.pins ?? {}).sort()).toEqual(["cheek", "eye_lid", "eye_line", "lip"]);
    }
    expect(Object.keys(SAMPLE_GRADES).sort()).toEqual(Object.values(SAMPLE_ATTEMPTS).sort());
    expect(SAMPLE_GRADES[SAMPLE_ATTEMPT].grade.total).toBe(SAMPLE_SCORE);
    expect(sampleAttemptFor("data:image/jpeg;base64,AAAA")).toBeNull(); // a preview answer is graded live, not from the table
    expect(sampleAttemptFor(null)).toBeNull();
  });
});

describe("C12 uncorrected monolid sample stays on the pre-generated lesson (same person, instant grade)", () => {
  it("the analyzer's raw Double-lid reading of the monolid sample still recommends the pre-generated lesson", () => {
    const raw = analyzedProfile("model-c");
    expect(recommendLesson(raw).lessonId).not.toBe(SAMPLE_LESSON); // the rule table alone would pick "shading" (no pre-generated renders)
    const r = analyzeSample(20, "model-c");
    expect(r.ok && r.recommendation.lessonId).toBe(SAMPLE_LESSON);
    expect(sampleRecommendation(raw).lessonId).toBe(SAMPLE_LESSON);
    expect(pregeneratedSteps(SAMPLE_LESSON, raw, undefined, "model-c")).toEqual(sampleModelById("model-c").rawSteps);
    // the visitor's correction keeps the rule-table pick
    expect(sampleRecommendation(sampleModelById("model-c").profile).lessonId).toBe(recommendLesson(sampleModelById("model-c").profile).lessonId);
  });

  it("a fallback attempt is the sample's own face, never the other sample's photo", () => {
    expect(sampleOwnAttempt("model-c")).toBe("/demo/model-c/sample-attempt.jpg");
    expect(sampleOwnAttempt("model-a")).toBe(SAMPLE_ATTEMPT);
    expect(SAMPLE_GRADES[sampleAttemptFor(sampleModelById("model-c").rawSteps![3])!].grade.total).toBe(SAMPLE_SCORE);
  });
});
