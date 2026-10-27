import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { checkQuality, isSkin, targetSize, type Pixels } from "@/lib/quality/gate";
import { ERROR_CODE_GUIDE, guideForErrorCode, guideText } from "@/lib/quality/messages";
import { syntheticSelfie } from "../helpers";

async function pixels(jpeg: Uint8Array, w = 240): Promise<Pixels> {
  const { data, info } = await sharp(jpeg).resize({ width: w }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

describe("F1 quality gate", () => {
  it("passes a well-lit, centered face that fills > 60% of the width", async () => {
    const r = checkQuality(await pixels(await syntheticSelfie()));
    expect(r.issues).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.faceWidth).toBeGreaterThanOrEqual(0.6);
  });

  it("flags a small face with the measured width (M1 '얼굴 폭 41% / 필요 60%')", async () => {
    const r = checkQuality(await pixels(await syntheticSelfie({ faceWidth: 0.41 })));
    expect(r.issues).toContain("face_too_small");
    expect(r.faceWidth).toBeGreaterThan(0.35);
    expect(r.faceWidth).toBeLessThan(0.47);
  });

  it("flags a dark photo as too_dark (and not as 'no face')", async () => {
    const r = checkQuality(await pixels(await syntheticSelfie({ brightness: 0.3 })));
    expect(r.issues).toEqual(["too_dark"]);
  });

  it("flags an off-center face as not_frontal", async () => {
    const r = checkQuality(await pixels(await syntheticSelfie({ faceWidth: 0.62, offsetX: 0.15 })));
    expect(r.issues).toContain("not_frontal");
  });

  it("reports no_face on an image without skin", async () => {
    const blank = new Uint8Array(await sharp({ create: { width: 300, height: 400, channels: 3, background: "#4a6a9a" } }).jpeg().toBuffer());
    expect(checkQuality(await pixels(blank)).issues).toEqual(["no_face"]);
  });

  it("skin classifier accepts light and deep skin tones, rejects blue/green", () => {
    expect(isSkin(224, 180, 150)).toBe(true);
    expect(isSkin(141, 85, 60)).toBe(true);
    expect(isSkin(70, 90, 120)).toBe(false);
    expect(isSkin(60, 160, 70)).toBe(false);
  });

  it("resizes the long side to 1600 (always under the 1920 VTO limit) and never upscales", () => {
    expect(targetSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("API error code → guide copy", () => {
  it("maps documented Face Analyzer / VTO codes to retake guidance", () => {
    expect(guideForErrorCode("error_face_position_too_small")).toBe("face_too_small");
    expect(guideForErrorCode("error_src_face_too_small")).toBe("face_too_small");
    expect(guideForErrorCode("error_lighting_dark")).toBe("too_dark");
    expect(guideForErrorCode("error_face_angle_upward")).toBe("angle_up");
    expect(guideForErrorCode("something_new")).toBe("retry");
    expect(guideText("face_too_small", "ko")).toContain("조금 더 가까이");
    expect(guideText("too_dark", "en")).toMatch(/light/);
  });

  it("every mapped code has ko and en copy", () => {
    for (const key of Object.values(ERROR_CODE_GUIDE)) {
      expect(guideText(key, "ko").length).toBeGreaterThan(3);
      expect(guideText(key, "en").length).toBeGreaterThan(3);
    }
  });
});
