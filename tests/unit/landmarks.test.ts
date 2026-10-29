import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { LANDMARK_POLYGONS, landmarkMeasure, parseLandmarkMeasure, pointInPolygon, polygonMeanLab, type LandmarkMeasure, type Pt, type RgbaImage } from "@/lib/grade/landmarks";
import { deltaE2000, rgbToLab } from "@/lib/color";
import { buildExplainRequest } from "@/lib/grade/claude";
import { gradeAttempt } from "@/lib/services/grade";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { POST } from "@/app/api/grade/route";
import { syntheticSelfie } from "../helpers";

afterEach(() => setRuntime(undefined));

function image(w: number, h: number, color: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = color(x, y);
      const i = (y * w + x) * 4;
      data.set([r, g, b, 255], i);
    }
  return { data, width: w, height: h };
}

/** Deterministic pseudo-mesh: 478 points scattered over the middle of the frame. */
function fakeLandmarks(dx = 0): Pt[] {
  return Array.from({ length: 478 }, (_, i) => ({ x: 0.2 + (0.5 * ((i * 37) % 101)) / 101 + dx, y: 0.2 + (0.6 * ((i * 61) % 103)) / 103 }));
}

const gradient = (shift = 0) => (x: number, y: number): [number, number, number] => [((x - shift) * 2) % 256, (y * 3) % 256, 120];

describe("S1 landmark polygons (#17)", () => {
  it("pointInPolygon and hole exclusion", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 5 }, sq)).toBe(false);
    // left half red, right half blue; hole over the right half → only red counted
    const img = image(20, 20, (x) => (x < 10 ? [220, 40, 40] : [40, 40, 220]));
    const outer = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    const hole = [
      { x: 10, y: -1 },
      { x: 21, y: -1 },
      { x: 21, y: 21 },
      { x: 10, y: 21 },
    ];
    const r = polygonMeanLab(img, [{ outer, holes: [hole] }]);
    expect(r.pixels).toBe(200);
    expect(deltaE2000(r.lab, rgbToLab(220, 40, 40))).toBeLessThan(0.5);
  });

  it("polygons use valid mesh indices (0..477), every region has area", () => {
    for (const polys of Object.values(LANDMARK_POLYGONS))
      for (const p of polys) for (const i of [...p.outer, ...(p.holes ?? []).flat()]) expect(i >= 0 && i < 478).toBe(true);
    const m = landmarkMeasure(image(480, 640, gradient()), fakeLandmarks(), image(480, 640, gradient()), fakeLandmarks());
    expect(m).not.toBeNull();
    expect(m!.regions.map((r) => r.region)).toEqual(["eye_line", "eye_lid", "cheek", "lip"]);
    expect(m!.regions.every((r) => r.deltaE === 0)).toBe(true);
  });

  it("follows the face: a shifted attempt with shifted landmarks still measures ΔE≈0 (fixed boxes would not)", () => {
    const shiftPx = 48; // 10% of the width
    const a = landmarkMeasure(image(480, 640, gradient()), fakeLandmarks(), image(480, 640, gradient(shiftPx)), fakeLandmarks(shiftPx / 480))!;
    expect(Math.max(...a.regions.map((r) => r.deltaE))).toBeLessThan(1.5);
    // control: shifted image but unshifted landmarks → clearly different
    const b = landmarkMeasure(image(480, 640, gradient()), fakeLandmarks(), image(480, 640, gradient(shiftPx)), fakeLandmarks())!;
    expect(Math.max(...b.regions.map((r) => r.deltaE))).toBeGreaterThan(5);
  });

  it("detects a color difference and returns null without a face", () => {
    const m = landmarkMeasure(image(480, 640, () => [200, 120, 120]), fakeLandmarks(), image(480, 640, () => [200, 150, 140]), fakeLandmarks())!;
    for (const r of m.regions) expect(r.deltaE).toBeCloseTo(deltaE2000(rgbToLab(200, 120, 120), rgbToLab(200, 150, 140)), 0);
    expect(landmarkMeasure(image(10, 10, () => [0, 0, 0]), [], image(10, 10, () => [0, 0, 0]), [])).toBeNull();
  });

  it("API schema accepts numbers only and rejects malformed payloads", () => {
    const good = landmarkMeasure(image(480, 640, gradient()), fakeLandmarks(), image(480, 640, gradient()), fakeLandmarks());
    expect(parseLandmarkMeasure(JSON.parse(JSON.stringify(good)))).not.toBeNull();
    expect(parseLandmarkMeasure({ method: "landmarks", regions: good!.regions.slice(0, 3) })).toBeNull();
    expect(parseLandmarkMeasure({ ...good, regions: good!.regions.map((r) => ({ ...r, region: "lip" })) })).toBeNull();
    expect(parseLandmarkMeasure({ ...good, regions: good!.regions.map((r) => ({ ...r, answerLab: [500, 0, 0] })) })).toBeNull();
    expect(parseLandmarkMeasure(null)).toBeNull();
  });
});

function lm(attemptLab: [number, number, number], fakeDeltaE = 0): LandmarkMeasure {
  return {
    method: "landmarks",
    regions: (["eye_line", "eye_lid", "cheek", "lip"] as const).map((region) => ({ region, deltaE: fakeDeltaE, answerLab: [55, 30, 15], attemptLab, pixels: 500 })),
  };
}

describe("S1 /api/grade with landmark numbers", () => {
  it("scores from server-recomputed ΔE (client ΔE ignored) with rule tips when no LLM", async () => {
    const img = await syntheticSelfie();
    const r = await gradeAttempt(img, img, {}, lm([70, 20, 10], 0));
    if ("error" in r) throw new Error(r.error);
    expect(r.grader).toBe("landmark");
    expect(r.explainer).toBe("rules");
    const dE = Math.round(deltaE2000([55, 30, 15], [70, 20, 10]) * 10) / 10;
    expect(r.regions[0].deltaE).toBe(dE);
    expect(r.total).toBeLessThan(80);
    expect(r.regions[0].tip.ko).toMatch(/진하게|한 번 더|위로/); // attempt lighter → "more"
  });

  it("Claude only writes the sentences: text-only request, scores unchanged; failure keeps rule tips", async () => {
    const img = await syntheticSelfie();
    const tips = { regions: (["eye_line", "eye_lid", "cheek", "lip"] as const).map((region) => ({ region, tip_ko: `${region} 팁`, tip_en: `${region} tip` })) };
    const create = vi.fn(async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(tips) }] }) as unknown as Anthropic.Beta.BetaMessage);
    const base = await gradeAttempt(img, img, {}, lm([60, 28, 14]));
    const r = await gradeAttempt(img, img, { create, model: "claude-opus-5-5" }, lm([60, 28, 14]));
    if ("error" in r || "error" in base) throw new Error("grade failed");
    expect(r.explainer).toBe("claude");
    expect(r.regions.map((x) => x.score)).toEqual(base.regions.map((x) => x.score));
    expect(r.regions[3].tip).toEqual({ ko: "lip 팁", en: "lip tip" });
    const req = (create.mock.calls[0] as unknown as [Anthropic.Beta.MessageCreateParamsNonStreaming])[0];
    expect(JSON.stringify(req.messages)).not.toMatch(/"image"/);
    expect(JSON.stringify(req.messages)).toMatch(/ΔE2000/);

    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    const f = await gradeAttempt(img, img, { create: failing }, lm([60, 28, 14]));
    if ("error" in f) throw new Error(f.error);
    expect(f).toMatchObject({ grader: "landmark", explainer: "rules" });
  });

  it("explain request carries the numbers per region", () => {
    const req = buildExplainRequest([{ region: "lip", score: 70, deltaE: 7.5, answerLab: [50, 40, 10], attemptLab: [60, 30, 10] }], "claude-opus-5-5");
    expect(JSON.stringify(req.messages)).toContain("ΔE2000 7.5");
    expect(req.output_config?.effort).toBe("low");
  });

  it("route: valid landmarks → landmark grader; malformed → F6 fallback", async () => {
    setRuntime(createRuntime(readConfig({}), createMockTransport()));
    const img = await syntheticSelfie();
    const send = async (landmarks: unknown) => {
      const form = new FormData();
      form.set("answer", new Blob([img], { type: "image/jpeg" }));
      form.set("attempt", new Blob([img], { type: "image/jpeg" }));
      form.set("landmarks", JSON.stringify(landmarks));
      return (await (await POST(new Request("http://x/api/grade", { method: "POST", body: form }))).json()) as { grader: string };
    };
    expect((await send(lm([55, 30, 15]))).grader).toBe("landmark");
    expect((await send({ method: "landmarks", regions: [] })).grader).toBe("local");
  });
});
