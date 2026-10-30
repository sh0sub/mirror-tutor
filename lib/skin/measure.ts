import { deltaE2000, labToHex, rgbToLab, type Lab } from "../color";
import { forEachPolygonPixel, LANDMARK_POLYGONS, type Pt, type RgbaImage } from "../grade/landmarks";

/**
 * Skin tone from the capture photo, measured in the browser on MediaPipe landmarks (pure, unit-tested in node).
 * Patches: both cheek apples (the grader's cheek polygons) and the lower-central forehead. Inside each patch
 * the darkest/brightest pixels by L* (shadow, pores, hair, specular shine) are dropped, the rest is averaged in
 * CIELAB. The forehead joins only when it agrees with the cheeks (bangs, glare); under side light the
 * shadowed cheek is dropped. Approximate: camera white balance and room light shift the result, so the UI
 * shows a low-confidence hint and lets the user override.
 */

/** Lower-central forehead: brow tops 107/336, glabella 9, mid-forehead 151 with its neighbors 108/337. */
export const FOREHEAD_POLYGON = [108, 151, 337, 336, 9, 107];
/** Fraction of pixels dropped at each end of the L* range inside a patch. */
export const TRIM = 0.2;
export const MIN_PATCH_PIXELS = 30;
/** Cheek-to-cheek ΔE2000 above this → uneven light (one side in shadow) → low confidence. */
export const MAX_CHEEK_SPREAD = 6;
/** Forehead joins the average only within this ΔE2000 of the cheeks. */
export const FOREHEAD_AGREE = 8;
/** Measured L* outside this range → photo too dark / too bright to trust. */
export const L_RANGE = [35, 88] as const;

export type SkinWarning = "uneven_light" | "too_dark" | "too_bright";

export interface SkinMeasure {
  hex: string;
  lab: Lab;
  /** ΔE2000 between the two cheek patches. */
  spread: number;
  usedForehead: boolean;
  confidence: "ok" | "low";
  warning?: SkinWarning;
}

/** Trimmed mean in CIELAB over the pixels of one patch; null when the patch is (nearly) empty. */
export function patchLab(img: RgbaImage, polys: Array<{ outer: Pt[] }>): Lab | null {
  const px: Lab[] = [];
  forEachPolygonPixel(img, polys, (r, g, b) => px.push(rgbToLab(r, g, b)));
  if (px.length < MIN_PATCH_PIXELS) return null;
  px.sort((p, q) => p[0] - q[0]);
  const cut = Math.floor(px.length * TRIM);
  return meanLab(px.slice(cut, px.length - cut));
}

const meanLab = (ls: Lab[]): Lab => [0, 1, 2].map((k) => ls.reduce((s, l) => s + l[k], 0) / ls.length) as Lab;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function measureSkin(img: RgbaImage, landmarks: Pt[]): SkinMeasure | null {
  if (landmarks.length < 468) return null;
  const px = (i: number) => ({ x: landmarks[i].x * img.width, y: landmarks[i].y * img.height });
  const [left, right] = LANDMARK_POLYGONS.cheek.map((p) => patchLab(img, [{ outer: p.outer.map(px) }]));
  if (!left || !right) return null;
  const forehead = patchLab(img, [{ outer: FOREHEAD_POLYGON.map(px) }]);
  const spread = round1(deltaE2000(left, right));
  let patches: Lab[];
  if (spread <= MAX_CHEEK_SPREAD) {
    // both cheeks agree; the forehead joins unless bangs or glare make it differ
    patches = forehead && deltaE2000(forehead, meanLab([left, right])) <= FOREHEAD_AGREE ? [left, right, forehead] : [left, right];
  } else {
    // side light: keep the cheek the forehead agrees with, else the lit (lighter) cheek — the shadow side reads too deep
    const near = forehead && [left, right].sort((p, q) => deltaE2000(p, forehead) - deltaE2000(q, forehead))[0];
    patches = near && deltaE2000(near, forehead) <= FOREHEAD_AGREE ? [near, forehead] : [left[0] >= right[0] ? left : right];
  }
  const lab = meanLab(patches).map(round1) as Lab;
  const warning: SkinWarning | undefined =
    lab[0] < L_RANGE[0] ? "too_dark" : lab[0] > L_RANGE[1] ? "too_bright" : spread > MAX_CHEEK_SPREAD ? "uneven_light" : undefined;
  return { hex: labToHex(lab), lab, spread, usedForehead: !!forehead && patches.includes(forehead), confidence: warning ? "low" : "ok", ...(warning && { warning }) };
}
