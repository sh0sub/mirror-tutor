import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CANONICAL_ANCHORS, REGIONS, fitBox, parseAnchors, regionBoxes, type FaceAnchors } from "@/lib/regions";
import { mockRenderEffects, registerMockAnchors } from "@/lib/youcam/mockRender";
import { sha256 } from "@/lib/cache";

// face larger and lower than the guide assumes (what a close, cropped selfie looks like)
const BIG_LOW: FaceAnchors = { leftEye: { x: 0.3, y: 0.45 }, rightEye: { x: 0.7, y: 0.45 }, mouth: { x: 0.5, y: 0.8 } };

describe("face anchors → region fit", () => {
  it("canonical anchors leave the boxes unchanged; no anchors = fixed boxes", () => {
    for (const b of Object.values(REGIONS).flat()) {
      const f = fitBox(b, CANONICAL_ANCHORS);
      expect(f.x).toBeCloseTo(b.x, 6);
      expect(f.y).toBeCloseTo(b.y, 6);
      expect(f.w).toBeCloseTo(b.w, 6);
      expect(f.h).toBeCloseTo(b.h, 6);
      expect(fitBox(b, null)).toBe(b);
    }
  });

  it("moves the lip box onto the detected mouth", () => {
    const [lip] = regionBoxes("lip", BIG_LOW);
    expect(lip.x + lip.w / 2).toBeCloseTo(0.5, 2);
    expect(lip.y + lip.h / 2).toBeCloseTo(0.8, 1);
    expect(lip.w).toBeGreaterThan(REGIONS.lip[0].w);
  });

  it("rejects malformed or degenerate anchors from the form", () => {
    expect(parseAnchors(BIG_LOW)).toEqual(BIG_LOW);
    expect(parseAnchors(null)).toBeNull();
    expect(parseAnchors({ leftEye: { x: 0.7, y: 0.4 }, rightEye: { x: 0.3, y: 0.4 }, mouth: { x: 0.5, y: 0.7 } })).toBeNull(); // swapped
    expect(parseAnchors({ leftEye: { x: 0.3, y: 0.6 }, rightEye: { x: 0.7, y: 0.6 }, mouth: { x: 0.5, y: 0.5 } })).toBeNull(); // mouth above eyes
    expect(parseAnchors({ leftEye: { x: 2, y: 0.4 }, rightEye: { x: 0.7, y: 0.4 }, mouth: { x: 0.5, y: 0.7 } })).toBeNull();
    expect(parseAnchors({ leftEye: { x: "0.3", y: 0.4 }, rightEye: { x: 0.7, y: 0.4 }, mouth: { x: 0.5, y: 0.7 } })).toBeNull();
  });
});

describe("mock renderer uses registered anchors", () => {
  const W = 300;
  const H = 400;
  const gray = () => sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } } }).jpeg().toBuffer();
  const redAt = async (jpeg: Uint8Array, nx: number, ny: number) => {
    const { data } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    const i = (Math.round(ny * H) * W + Math.round(nx * W)) * 3;
    return data[i] - data[i + 1]; // red minus green
  };
  const lipstick = [{ category: "lip_color", palettes: [{ color: "#ff0000", colorIntensity: 100 }] }] as never;

  it("paints the lips where the face actually is", async () => {
    const src = new Uint8Array(await gray());
    registerMockAnchors(sha256(src), BIG_LOW);
    const out = await mockRenderEffects(src, lipstick);
    expect(await redAt(out, 0.5, 0.8)).toBeGreaterThan(40); // detected mouth
    expect(await redAt(out, 0.5, 0.62)).toBeLessThan(15); // old fixed lip box (now on the nose/chin gap)
  });

  it("falls back to the fixed boxes without anchors", async () => {
    const src = new Uint8Array(await sharp(await gray()).jpeg({ quality: 70 }).toBuffer()); // different hash
    const out = await mockRenderEffects(src, lipstick);
    expect(await redAt(out, 0.5, 0.635)).toBeGreaterThan(40);
  });

  it("keeps cheek and foundation overlays faint so mock answers never look like a bruise", async () => {
    const src = new Uint8Array(await sharp(await gray()).jpeg({ quality: 60 }).toBuffer());
    const out = await mockRenderEffects(src, [
      { category: "blush", palettes: [{ color: "#ff0000", colorIntensity: 100 }] },
      { category: "foundation", palettes: [{ color: "#ff0000", colorIntensity: 100 }] },
    ] as never);
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    let max = 0;
    for (let i = 0; i < data.length; i += 3) max = Math.max(max, data[i] - data[i + 1]);
    expect(max).toBeLessThan(80); // red-green delta; the old 0.75 opacity gave ~190
  });
});
