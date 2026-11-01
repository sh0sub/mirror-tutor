import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import type { YouCamTransport } from "@/lib/youcam/client";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as renderPOST } from "@/app/api/render/route";
import { analyzeSample, isPregenerated, renderSample, SAMPLE_ATTEMPT, SAMPLE_LESSON, SAMPLE_MODEL } from "@/lib/services/sample";
import { SAMPLE_SCORE } from "@/lib/demo/sample";
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
    expect(SAMPLE_ATTEMPT).toBe("/demo/model-a/step-3.jpg");
    expect(SAMPLE_SCORE).toBe(91); // one sample score on the grade, share and home scenes (video + docs quote it)
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
