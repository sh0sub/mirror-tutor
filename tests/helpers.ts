import sharp from "sharp";
import { BROW_SHAPES, EYELIDS, EYE_SHAPES, FACE_SHAPES, LIP_SHAPES, type FaceProfile } from "@/lib/profile";

export function* allProfiles(): Generator<FaceProfile> {
  for (const eyelid of EYELIDS)
    for (const eyeShape of EYE_SHAPES)
      for (const lipShape of LIP_SHAPES)
        for (const faceShape of FACE_SHAPES)
          for (const eyebrowShape of BROW_SHAPES) yield { eyelid, eyeShape, lipShape, faceShape, eyebrowShape };
}

/**
 * Synthetic "selfie": warm background-free frame with a skin-toned face ellipse inside the guide oval.
 * No real face is used anywhere in tests (privacy principle ⑦).
 */
export async function syntheticSelfie(opts: { width?: number; height?: number; faceWidth?: number; brightness?: number; offsetX?: number } = {}) {
  const width = opts.width ?? 600;
  const height = opts.height ?? 800;
  const fw = (opts.faceWidth ?? 0.66) * width;
  const b = opts.brightness ?? 1;
  const skin = (r: number, g: number, bl: number) => `rgb(${Math.round(r * b)},${Math.round(g * b)},${Math.round(bl * b)})`;
  const cx = width / 2 + (opts.offsetX ?? 0) * width;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${skin(70, 90, 120)}"/>
    <ellipse cx="${cx}" cy="${height * 0.45}" rx="${fw / 2}" ry="${height * 0.33}" fill="${skin(224, 180, 150)}"/>
    <ellipse cx="${cx - fw * 0.18}" cy="${height * 0.4}" rx="${fw * 0.07}" ry="${height * 0.012}" fill="${skin(60, 40, 35)}"/>
    <ellipse cx="${cx + fw * 0.18}" cy="${height * 0.4}" rx="${fw * 0.07}" ry="${height * 0.012}" fill="${skin(60, 40, 35)}"/>
    <ellipse cx="${cx}" cy="${height * 0.635}" rx="${fw * 0.13}" ry="${height * 0.025}" fill="${skin(190, 110, 110)}"/>
  </svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer());
}
