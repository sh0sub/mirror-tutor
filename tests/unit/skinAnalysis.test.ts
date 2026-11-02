import { afterEach, describe, expect, it } from "vitest";
import { buildSkinRequest, normalizeSkin } from "@/lib/youcam/skinAnalysis";
import { analyzeSkin, skinSample } from "@/lib/services/skin";
import { analyzeFace } from "@/lib/services/analyze";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport, type MockOptions } from "@/lib/youcam/mock";
import { POST } from "@/app/api/skin/route";
import { sampleSkinCheck } from "@/lib/demo/sample";
import { baseChanges, BASE_RULES, MILD_BELOW, NOTICEABLE_BELOW, skinLevel, SKIN_CONCERN_KEYS, type SkinCheck } from "@/lib/skin/concerns";
import { SKIN_COST, skinAnalysisCost, fullFlowWithSkinCost } from "@/lib/units";
import { buildLesson } from "@/lib/lessons";
import type { SkinAnalysisResults } from "@/lib/youcam/types";
import modelA from "@/fixtures/youcam/live/skin-analysis.model-a.json";
import modelC from "@/fixtures/youcam/live/skin-analysis.model-c.json";
import cost from "@/fixtures/youcam/live/feature-cost.json";
import { syntheticSelfie } from "../helpers";

const fast = { sleep: async () => {} };
const rtWith = (opts: MockOptions = {}, env: Record<string, string> = {}) => createRuntime(readConfig(env), createMockTransport({ render: async (s) => s, runningPolls: 0, ...opts }));
afterEach(() => setRuntime(undefined));

describe("Skin Analysis request, units and normalization", () => {
  it("asks for the 4 SD concerns as json by file id", () => {
    expect(buildSkinRequest("f1")).toEqual({ src_file_id: "f1", dst_actions: ["dark_circle_v2", "redness", "oiliness", "pore"], format: "json" });
  });

  it("cost tiers match the live feature-cost list (SD V2.0)", () => {
    const sd = cost.skus.filter((s: { description: string }) => /Skin Analysis V2\.0 SD/.test(s.description)).map((s: { amount: number }) => s.amount);
    expect(sd).toEqual([skinAnalysisCost(4), skinAnalysisCost(8), skinAnalysisCost(12), skinAnalysisCost(16)]);
    expect(SKIN_COST).toBe(9);
    expect(fullFlowWithSkinCost()).toBe(23);
    expect(() => skinAnalysisCost(0)).toThrow();
  });

  it("normalizes the two live captures (ui_score, 1-100, higher = clearer) in a fixed concern order", () => {
    expect(normalizeSkin(modelA.results as SkinAnalysisResults)).toEqual([
      { key: "dark_circle", score: 67, level: "noticeable" },
      { key: "redness", score: 99, level: "clear" },
      { key: "oiliness", score: 89, level: "clear" },
      { key: "pores", score: 75, level: "mild" },
    ]);
    expect(normalizeSkin(modelC.results as SkinAnalysisResults).map((r) => [r.key, r.score])).toEqual([
      ["dark_circle", 79],
      ["redness", 99],
      ["oiliness", 91],
      ["pores", 81],
    ]);
  });

  it("ignores unknown or non-numeric items and never invents a concern", () => {
    expect(normalizeSkin({ output: [{ type: "all", score: 80 }, { type: "pore", ui_score: Number.NaN }, { type: "redness", ui_score: 40 }] })).toEqual([
      { key: "redness", score: 40, level: "noticeable" },
    ]);
    expect(normalizeSkin({})).toEqual([]);
  });

  it("level thresholds are 70 / 85", () => {
    expect([NOTICEABLE_BELOW, MILD_BELOW]).toEqual([70, 85]);
    expect([skinLevel(69), skinLevel(70), skinLevel(84), skinLevel(85)]).toEqual(["noticeable", "mild", "mild", "clear"]);
  });

  it("the pre-generated sample results are exactly the normalized live captures", () => {
    expect(sampleSkinCheck("model-a").readings).toEqual(normalizeSkin(modelA.results as SkinAnalysisResults));
    expect(sampleSkinCheck("model-c").readings).toEqual(normalizeSkin(modelC.results as SkinAnalysisResults));
    expect(sampleSkinCheck("model-a").source).toBe("sample");
  });
});

describe("skin concern -> base technique rule table", () => {
  it("every concern has a hand-written change and a reason in both languages", () => {
    for (const k of SKIN_CONCERN_KEYS) {
      const r = BASE_RULES[k];
      expect(r.change.ko && r.change.en && r.why.ko && r.why.en).toBeTruthy();
    }
    expect(BASE_RULES.dark_circle.change.en).toMatch(/peach corrector/i);
    expect(BASE_RULES.redness.change.en).toMatch(/green primer/i);
    expect(BASE_RULES.oiliness.change.en).toMatch(/mattifying primer.*thinner foundation/i);
    expect(BASE_RULES.pores.change.en).toMatch(/blurring primer/i);
  });

  it("only mild or noticeable concerns change the base, worst first", () => {
    const check: SkinCheck = {
      source: "live",
      readings: [
        { key: "dark_circle", score: 80, level: "mild" },
        { key: "redness", score: 55, level: "noticeable" },
        { key: "oiliness", score: 95, level: "clear" },
        { key: "pores", score: 90, level: "clear" },
      ],
    };
    expect(baseChanges(check).map((c) => c.key)).toEqual(["redness", "dark_circle"]);
    expect(baseChanges(null)).toEqual([]);
  });

  it("does not touch the Makeup VTO effects (the render stays the pre-generated one)", () => {
    const p = { eyelid: "double", eyeShape: "almond", lipShape: "average", faceShape: "oval", eyebrowShape: "rounded" } as const;
    expect(JSON.stringify(buildLesson("daily-k", p).steps[0].effects)).not.toMatch(/primer|corrector/i);
  });
});

describe("analyzeSkin (live path on the mock transport)", () => {
  it("charges 9u, returns readings and no URL", async () => {
    const t = createMockTransport({ render: async (s) => s, runningPolls: 0 });
    const rt = createRuntime(readConfig({}), t);
    const r = await analyzeSkin(rt, "s", await syntheticSelfie(), fast);
    expect(r).toMatchObject({ ok: true, mode: "mock", skin: { source: "live" }, units: { spent: 9 } });
    expect(JSON.stringify(r)).not.toMatch(/mock:\/\/|https?:\/\//);
    expect(t.charged).toBe(9);
    expect((await rt.guard.status("s")).sessionSpent).toBe(9);
  });

  it("reuses the Face Analyzer upload of the same photo (one file upload for analyze + skin)", async () => {
    const t = createMockTransport({ render: async (s) => s, runningPolls: 0 });
    const rt = createRuntime(readConfig({}), t);
    const img = await syntheticSelfie();
    await analyzeFace(rt, "s", img, fast);
    await analyzeSkin(rt, "s", img, fast);
    expect(t.calls.createFile).toBe(1);
    expect(t.calls.runTask).toMatchObject({ "face-attr-analysis": 1, "skin-analysis": 1 });
    expect(t.charged).toBe(19);
  });

  it("fits in the default session: analyze 10 + skin 9 + a 4-step lesson = 23 <= cap 24", async () => {
    const rt = rtWith();
    expect(rt.config.sessionCap).toBe(24);
    expect((await rt.guard.reserve("s", 10 + 9 + 4)).ok).toBe(true);
  });

  it("respects the session cap (denied, not charged)", async () => {
    const t = createMockTransport({ render: async (s) => s, runningPolls: 0 });
    const rt = createRuntime(readConfig({ SESSION_UNIT_CAP: "14" }), t);
    const img = await syntheticSelfie();
    await analyzeFace(rt, "s", img, fast);
    expect(await analyzeSkin(rt, "s", img, fast)).toMatchObject({ ok: false, status: 429, code: "session_cap" });
    expect(t.calls.runTask["skin-analysis"]).toBeUndefined();
  });

  it("an engine error is not billed and maps to a retake guide", async () => {
    const t = createMockTransport({ render: async (s) => s, runningPolls: 0, failFeature: { "skin-analysis": "error_no_face" } });
    const rt = createRuntime(readConfig({}), t);
    const r = await analyzeSkin(rt, "s", await syntheticSelfie(), fast);
    expect(r).toMatchObject({ ok: false, status: 422, code: "error_no_face" });
    expect((await rt.guard.status("s")).sessionSpent).toBe(0);
  });

  it("stays unavailable (not live) below the demo-mode threshold", async () => {
    const t = createMockTransport({ credit: 100 });
    const rt = createRuntime(readConfig({}), t);
    expect(await analyzeSkin(rt, "s", await syntheticSelfie(), fast)).toMatchObject({ ok: false, code: "demo_mode" });
    expect(t.calls.createFile).toBe(0);
  });

  it("the mock can return other readings (redness / oiliness branches)", async () => {
    const skinResults: SkinAnalysisResults = { output: [{ type: "redness", ui_score: 52 }, { type: "oiliness", ui_score: 66 }, { type: "pore", ui_score: 90 }, { type: "dark_circle_v2", ui_score: 95 }] };
    const rt = rtWith({ skinResults });
    const r = await analyzeSkin(rt, "s", await syntheticSelfie(), fast);
    expect(r.ok && baseChanges(r.skin).map((c) => c.key)).toEqual(["redness", "oiliness"]);
  });
});

describe("POST /api/skin", () => {
  it("sample=1 replays the pre-generated result at 0 units and never touches the transport", async () => {
    const t = createMockTransport();
    setRuntime(createRuntime(readConfig({}), t));
    const form = new FormData();
    form.set("sample", "1");
    form.set("sampleId", "model-c");
    const res = await POST(new Request("http://x/api/skin", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, mode: "sample", units: { spent: 0 }, skin: { source: "sample", readings: sampleSkinCheck("model-c").readings } });
    expect(t.calls).toMatchObject({ createFile: 0, put: 0, runTask: {}, getTask: 0 });
    expect(skinSample(24, "model-a").ok).toBe(true);
  });

  it("sample=1 ignores an attached image", async () => {
    const t = createMockTransport();
    setRuntime(createRuntime(readConfig({}), t));
    const form = new FormData();
    form.set("sample", "1");
    form.set("image", new Blob([await syntheticSelfie()], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(new Request("http://x/api/skin", { method: "POST", body: form }));
    expect((await res.json()).mode).toBe("sample");
    expect(t.calls.createFile).toBe(0);
  });

  it("an image runs the live (mock) path; no image is a 400", async () => {
    setRuntime(rtWith());
    const form = new FormData();
    form.set("image", new Blob([await syntheticSelfie()], { type: "image/jpeg" }), "selfie.jpg");
    const res = await POST(new Request("http://x/api/skin", { method: "POST", body: form }));
    expect(await res.json()).toMatchObject({ ok: true, skin: { source: "live" }, units: { spent: 9 } });
    expect((await POST(new Request("http://x/api/skin", { method: "POST", body: new FormData() }))).status).toBe(400);
  });
});
