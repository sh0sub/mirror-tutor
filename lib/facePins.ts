import { LANDMARK_POLYGONS, type Pt } from "./grade/landmarks";
import type { GradeRegion } from "./regions";

/**
 * Photo callouts (M2 attribute pins, M4 per-region score labels). Pure + isomorphic: landmark → pin point
 * picking runs in the browser on MediaPipe output (lib/client/landmarker); layout is lib/pinLayout. Points
 * stay on this device (never sent to the server). No landmarks → no pins (never a guessed position).
 */

/** Where each analyze attribute is pinned, normalized 0..1 in the source image. */
export interface FacePins {
  /** center of the image-left eye (eyelid + eye shape) */
  eye: Pt;
  /** middle of the image-right brow */
  brow: Pt;
  /** image-right lip corner */
  lip: Pt;
  /** image-left jaw/cheek contour (face shape) */
  cheek: Pt;
}

export type GradePins = Partial<Record<GradeRegion, Pt>>;

const MESH_SIZE = 468;
const mean = (f: Pt[], idx: number[]): Pt => ({
  x: idx.reduce((s, i) => s + f[i].x, 0) / idx.length,
  y: idx.reduce((s, i) => s + f[i].y, 0) / idx.length,
});
const finite = (p: Pt) => Number.isFinite(p.x) && Number.isFinite(p.y);
/** Picks the leftmost / rightmost of two candidates (works for mirrored and unmirrored photos). */
const pick = (a: Pt, b: Pt, side: "left" | "right") => ((a.x <= b.x) === (side === "left") ? a : b);

/** Canonical mesh: eye centers 33+133 / 362+263, brow mids 105+52 / 334+282, lip corners 61/291, jaw contour 132/361. */
const PIN_INDEXES = [33, 133, 362, 263, 105, 52, 334, 282, 61, 291, 132, 361];

export function facePinsFromLandmarks(f: Pt[]): FacePins | null {
  if (f.length < MESH_SIZE || !PIN_INDEXES.every((i) => finite(f[i]))) return null;
  const pins: FacePins = {
    eye: pick(mean(f, [33, 133]), mean(f, [362, 263]), "left"),
    brow: pick(mean(f, [105, 52]), mean(f, [334, 282]), "right"),
    lip: pick(f[61], f[291], "right"),
    cheek: pick(f[132], f[361], "left"),
  };
  return { eye: { ...pins.eye }, brow: { ...pins.brow }, lip: { ...pins.lip }, cheek: { ...pins.cheek } };
}

/**
 * Grade label points on the ATTEMPT photo's own landmarks: eye line on the image-left eye, lid on the
 * image-right lid (so the two eye labels don't stack), cheek on the image-left cheek, lip at the lips.
 */
export function gradePinsFromLandmarks(f: Pt[]): GradePins | null {
  if (f.length < MESH_SIZE) return null;
  const sided = (region: GradeRegion, side: "left" | "right") => {
    const [a, b] = LANDMARK_POLYGONS[region].map((p) => mean(f, p.outer)) // vertex centroid;
    return b ? pick(a, b, side) : a;
  };
  const pins: GradePins = {
    eye_line: sided("eye_line", "left"),
    eye_lid: sided("eye_lid", "right"),
    cheek: sided("cheek", "left"),
    lip: sided("lip", "left"),
  };
  return Object.values(pins).every((p) => p && finite(p)) ? pins : null;
}
