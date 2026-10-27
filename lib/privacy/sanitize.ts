import sharp from "sharp";

/**
 * Privacy ② : strip EXIF (GPS, device, timestamps) by re-encoding. sharp drops all metadata unless
 * `.withMetadata()` / `.keepMetadata()` is called, so we bake the orientation in first (`rotate()`)
 * and then emit a clean JPEG. Also enforces the size limits: long side ≤ 1600 (plan) which keeps
 * Makeup VTO's "long side < 1920" and Face Analyzer's "≤ 4096 / < 10MB" requirements.
 * Runs in memory only; nothing is written to disk (privacy ①).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class ImageRejectedError extends Error {
  constructor(readonly code: "too_large" | "unsupported_type" | "undecodable" | "too_small") {
    super(`image rejected: ${code}`);
    this.name = "ImageRejectedError";
  }
}

export async function sanitizeImage(input: Uint8Array, longSide = 1600): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageRejectedError("too_large");
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new ImageRejectedError("undecodable");
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new ImageRejectedError("unsupported_type");
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: longSide, height: longSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  // Face Analyzer minimum 320 px (error_below_min_image_size); VTO minimum 100 px.
  if (Math.min(info.width, info.height) < 320) throw new ImageRejectedError("too_small");
  return { bytes: new Uint8Array(data), width: info.width, height: info.height };
}
