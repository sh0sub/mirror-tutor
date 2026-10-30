/**
 * Face regions in normalized image coordinates (0..1), assuming the selfie was taken inside the
 * M1 guide oval (center 0.5/0.45, width 60% of the frame). Used by: mock VTO overlays, the MVP
 * grading crops (F6), the swatch → region highlight (F7) and the share card.
 * S1 (MediaPipe landmarks) would replace these fixed boxes with real polygons.
 */

export type RegionId = "brow" | "eye_lid" | "eye_line" | "cheek" | "lip" | "base" | "contour";
export type GradeRegion = "eye_line" | "eye_lid" | "cheek" | "lip";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bilateral regions list left then right. */
export const REGIONS: Record<RegionId, Box[]> = {
  base: [{ x: 0.22, y: 0.18, w: 0.56, h: 0.6 }],
  brow: [
    { x: 0.3, y: 0.315, w: 0.15, h: 0.035 },
    { x: 0.55, y: 0.315, w: 0.15, h: 0.035 },
  ],
  eye_lid: [
    { x: 0.31, y: 0.355, w: 0.14, h: 0.045 },
    { x: 0.55, y: 0.355, w: 0.14, h: 0.045 },
  ],
  eye_line: [
    { x: 0.31, y: 0.395, w: 0.15, h: 0.02 },
    { x: 0.54, y: 0.395, w: 0.15, h: 0.02 },
  ],
  cheek: [
    { x: 0.27, y: 0.47, w: 0.13, h: 0.09 },
    { x: 0.6, y: 0.47, w: 0.13, h: 0.09 },
  ],
  contour: [
    { x: 0.23, y: 0.53, w: 0.1, h: 0.1 },
    { x: 0.67, y: 0.53, w: 0.1, h: 0.1 },
  ],
  lip: [{ x: 0.41, y: 0.6, w: 0.18, h: 0.07 }],
};

/** Eye centers and mouth center in normalized photo coordinates (from MediaPipe in the browser). */
export interface FaceAnchors {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  mouth: { x: number; y: number };
}

/** Where REGIONS assumes those points are (face centered in the guide oval). */
export const CANONICAL_ANCHORS: FaceAnchors = {
  leftEye: { x: 0.385, y: 0.395 },
  rightEye: { x: 0.615, y: 0.395 },
  mouth: { x: 0.5, y: 0.635 },
};

const isPt = (p: unknown): p is { x: number; y: number } =>
  !!p && typeof p === "object" && [(p as { x: unknown }).x, (p as { y: unknown }).y].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1);

/** Validates untrusted anchors (form field). Rejects degenerate faces (eyes swapped / mouth above eyes). */
export function parseAnchors(v: unknown): FaceAnchors | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (!isPt(a.leftEye) || !isPt(a.rightEye) || !isPt(a.mouth)) return null;
  const eyeDist = a.rightEye.x - a.leftEye.x;
  const eyeY = (a.leftEye.y + a.rightEye.y) / 2;
  if (eyeDist < 0.05 || a.mouth.y - eyeY < 0.05) return null;
  return { leftEye: { ...a.leftEye }, rightEye: { ...a.rightEye }, mouth: { ...a.mouth } };
}

/**
 * Moves and scales a canonical region box onto the detected face: horizontal scale from the eye
 * distance, vertical scale from the eye → mouth distance, origin at the eyes' midpoint. No anchors →
 * the canonical box (the old fixed-position behavior).
 */
export function fitBox(b: Box, anchors?: FaceAnchors | null): Box {
  if (!anchors) return b;
  const c = CANONICAL_ANCHORS;
  const cMid = { x: (c.leftEye.x + c.rightEye.x) / 2, y: (c.leftEye.y + c.rightEye.y) / 2 };
  const mid = { x: (anchors.leftEye.x + anchors.rightEye.x) / 2, y: (anchors.leftEye.y + anchors.rightEye.y) / 2 };
  const sx = (anchors.rightEye.x - anchors.leftEye.x) / (c.rightEye.x - c.leftEye.x);
  const sy = (anchors.mouth.y - mid.y) / (c.mouth.y - cMid.y);
  return { x: mid.x + (b.x - cMid.x) * sx, y: mid.y + (b.y - cMid.y) * sy, w: b.w * sx, h: b.h * sy };
}

export function regionBoxes(region: RegionId, anchors?: FaceAnchors | null): Box[] {
  return REGIONS[region].map((b) => fitBox(b, anchors));
}

/** VTO category → region it paints. */
export const CATEGORY_REGION: Record<string, RegionId> = {
  foundation: "base",
  concealer: "base",
  skin_smooth: "base",
  eyebrows: "brow",
  eye_shadow: "eye_lid",
  eye_liner: "eye_line",
  eyelashes: "eye_line",
  blush: "cheek",
  bronzer: "contour",
  contour: "contour",
  highlighter: "cheek",
  lip_color: "lip",
  lip_liner: "lip",
};

export const GRADE_REGIONS: GradeRegion[] = ["eye_line", "eye_lid", "cheek", "lip"];

/** Grading crop: union of the region boxes with some padding, clamped to the frame. */
export function gradeCropBox(region: GradeRegion, pad = 0.02): Box {
  const boxes = REGIONS[region];
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const x1 = Math.min(1, Math.max(...boxes.map((b) => b.x + b.w)) + pad);
  const y1 = Math.min(1, Math.max(...boxes.map((b) => b.y + b.h)) + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function toPixels(b: Box, width: number, height: number) {
  const left = Math.round(b.x * width);
  const top = Math.round(b.y * height);
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round(b.w * width))),
    height: Math.max(1, Math.min(height - top, Math.round(b.h * height))),
  };
}
