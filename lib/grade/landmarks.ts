import { z } from "zod";
import { deltaE2000, rgbToLab, type Lab } from "../color";
import { GRADE_REGIONS, type GradeRegion } from "../regions";

/**
 * S1 (#17) landmark-aligned ΔE. Pure, isomorphic (runs in the browser on MediaPipe Face Landmarker
 * output; unit-tested in node). Each region is a set of polygons over the 468-point canonical face
 * mesh, so the same anatomical area is compared even when the attempt photo is framed differently —
 * unlike the fixed boxes of the F6 MVP grader, which stays as the fallback.
 *
 * Index rings follow the MediaPipe canonical mesh (eye contour → 2nd ring → 3rd ring toward the brow).
 * (미확인: 폴리곤 경계는 실제 사진 오버레이로 눈 확인 필요 — 지수는 표준 메시 기준.)
 */

export interface Pt {
  x: number;
  y: number;
}
export interface Poly {
  outer: number[];
  holes?: number[][];
}

const LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

export const LANDMARK_POLYGONS: Record<GradeRegion, Poly[]> = {
  // band from the upper lash line to the first ring above it (where liner sits)
  eye_line: [
    { outer: [33, 246, 161, 160, 159, 158, 157, 173, 133, 243, 190, 56, 28, 27, 29, 30, 247, 130] },
    { outer: [263, 466, 388, 387, 386, 385, 384, 398, 362, 463, 414, 286, 258, 257, 259, 260, 467, 359] },
  ],
  // band between the 2nd and 3rd rings (lid space where shadow sits, below the brow)
  eye_lid: [
    { outer: [130, 247, 30, 29, 27, 28, 56, 190, 243, 244, 189, 221, 222, 223, 224, 225, 113] },
    { outer: [359, 467, 260, 259, 257, 258, 286, 414, 463, 464, 413, 441, 442, 443, 444, 445, 342] },
  ],
  // apple of the cheek, below the eye and outside the nose
  cheek: [{ outer: [116, 117, 118, 101, 36, 205, 187, 123] }, { outer: [345, 346, 347, 330, 266, 425, 411, 352] }],
  // lips without the open mouth
  lip: [{ outer: LIP_OUTER, holes: [LIP_INNER] }],
};

export const MIN_REGION_PIXELS = 40;

export interface RgbaImage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/** Ray-casting point-in-polygon. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Mean CIELAB over every pixel center inside the polygons (minus holes). */
export function polygonMeanLab(img: RgbaImage, polys: Array<{ outer: Pt[]; holes?: Pt[][] }>): { lab: Lab; pixels: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const poly of polys) {
    if (poly.outer.length < 3) continue;
    const xs = poly.outer.map((p) => p.x);
    const ys = poly.outer.map((p) => p.y);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)));
    const x1 = Math.min(img.width - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(img.height - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = { x: x + 0.5, y: y + 0.5 };
        if (!pointInPolygon(c, poly.outer)) continue;
        if (poly.holes?.some((h) => pointInPolygon(c, h))) continue;
        const i = (y * img.width + x) * 4;
        r += img.data[i];
        g += img.data[i + 1];
        b += img.data[i + 2];
        n++;
      }
    }
  }
  return { lab: n ? rgbToLab(r / n, g / n, b / n) : [0, 0, 0], pixels: n };
}

/** Normalized landmarks (0..1) → pixel polygons for one region. */
export function regionPolygons(landmarks: Pt[], region: GradeRegion, width: number, height: number) {
  const px = (i: number) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });
  return LANDMARK_POLYGONS[region].map((p) => ({ outer: p.outer.map(px), holes: p.holes?.map((h) => h.map(px)) }));
}

export interface LandmarkRegion {
  region: GradeRegion;
  deltaE: number;
  answerLab: Lab;
  attemptLab: Lab;
  pixels: number;
}

export interface LandmarkMeasure {
  method: "landmarks";
  regions: LandmarkRegion[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Both photos carry their own landmarks, so each region is sampled on the right anatomy in each image. */
export function landmarkMeasure(answer: RgbaImage, answerLm: Pt[], attempt: RgbaImage, attemptLm: Pt[]): LandmarkMeasure | null {
  if (answerLm.length < 468 || attemptLm.length < 468) return null;
  const regions: LandmarkRegion[] = [];
  for (const region of GRADE_REGIONS) {
    const a = polygonMeanLab(answer, regionPolygons(answerLm, region, answer.width, answer.height));
    const b = polygonMeanLab(attempt, regionPolygons(attemptLm, region, attempt.width, attempt.height));
    if (a.pixels < MIN_REGION_PIXELS || b.pixels < MIN_REGION_PIXELS) return null;
    regions.push({
      region,
      deltaE: round1(deltaE2000(a.lab, b.lab)),
      answerLab: a.lab.map(round1) as Lab,
      attemptLab: b.lab.map(round1) as Lab,
      pixels: Math.min(a.pixels, b.pixels),
    });
  }
  return { method: "landmarks", regions };
}

const LabSchema = z.tuple([z.number().min(0).max(100), z.number().min(-128).max(128), z.number().min(-128).max(128)]);

/** What /api/grade accepts from the browser (numbers only — no image or landmark coordinates). */
export const LandmarkMeasureSchema = z.object({
  method: z.literal("landmarks"),
  regions: z
    .array(
      z.object({
        region: z.enum(["eye_line", "eye_lid", "cheek", "lip"]),
        deltaE: z.number().min(0).max(150),
        answerLab: LabSchema,
        attemptLab: LabSchema,
        pixels: z.number().int().min(MIN_REGION_PIXELS),
      }),
    )
    .length(4)
    .refine((rs) => new Set(rs.map((r) => r.region)).size === 4, "regions must be unique"),
});

export function parseLandmarkMeasure(raw: unknown): LandmarkMeasure | null {
  const r = LandmarkMeasureSchema.safeParse(raw);
  return r.success ? (r.data as LandmarkMeasure) : null;
}
