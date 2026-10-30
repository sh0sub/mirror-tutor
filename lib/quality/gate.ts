/**
 * F1 client-side quality gate (runs in the browser on a downscaled frame; pure so it is unit-testable).
 * Checks the YouCam input requirements before spending units: face width > 60% of the frame,
 * enough light, roughly frontal. MVP face detection is a skin-tone heuristic inside the guide oval;
 * S1 (MediaPipe Face Landmarker) would replace `estimateFace` with real landmarks.
 */

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, row-major (same layout as ImageData.data). */
  data: Uint8ClampedArray | Uint8Array;
}

export type QualityIssue = "no_face" | "face_too_small" | "too_dark" | "too_bright" | "not_frontal";

export interface QualityResult {
  pass: boolean;
  issues: QualityIssue[];
  /** Face width as a fraction of frame width (0..1). Shown as "얼굴 폭 41% / 필요 60%". */
  faceWidth: number;
  /** Mean luma 0..255 inside the guide oval. */
  brightness: number;
  /** Horizontal offset of the face center from the frame center (−0.5..0.5). */
  offset: number;
}

export const MIN_FACE_WIDTH = 0.6;
export const MIN_BRIGHTNESS = 85;
export const MAX_CLIPPED_RATIO = 0.25;
export const MAX_OFFSET = 0.08;

/** Skin classifier in YCbCr (Chai & Ngan ranges), tolerant of most skin tones under indoor light. */
export function isSkin(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

export function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Widest skin run per row across the middle band of the face (rows 35%–60% of the height, where
 * cheeks are widest), using the median of per-row widths for robustness.
 */
export function estimateFace(px: Pixels): { width: number; center: number; skinRatio: number } {
  const { width, height, data } = px;
  const y0 = Math.floor(height * 0.35);
  const y1 = Math.floor(height * 0.6);
  const widths: number[] = [];
  const centers: number[] = [];
  let skin = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 2) {
    // Collect skin runs, then keep the one closest to the frame center (ties → longer). Picking the
    // longest run let warm lamps / wood / walls at the edge win and dragged the center sideways.
    const runs: Array<[number, number]> = [];
    let run = 0;
    let runStart = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const s = isSkin(data[i], data[i + 1], data[i + 2]);
      total++;
      if (s) {
        skin++;
        if (run === 0) runStart = x;
        run++;
        if (x === width - 1) runs.push([runStart, run]);
      } else {
        // tolerate small gaps (eyes, shadows) up to 2% of the width
        if (run > 0) {
          let gap = 0;
          while (gap < width * 0.02 && x + gap < width) {
            const j = (y * width + x + gap) * 4;
            if (isSkin(data[j], data[j + 1], data[j + 2])) break;
            gap++;
          }
          if (gap < width * 0.02 && x + gap < width) {
            run += gap;
            x += gap - 1;
            continue;
          }
          runs.push([runStart, run]);
        }
        run = 0;
      }
    }
    const minRun = width * 0.08; // ignore specks
    let best = 0;
    let bestStart = 0;
    let bestDist = Infinity;
    for (const [start, len] of runs) {
      if (len < minRun) continue;
      const dist = start <= width / 2 && start + len >= width / 2 ? 0 : Math.min(Math.abs(start - width / 2), Math.abs(start + len - width / 2));
      if (dist < bestDist || (dist === bestDist && len > best)) {
        best = len;
        bestStart = start;
        bestDist = dist;
      }
    }
    if (best > 0) {
      widths.push(best);
      centers.push(bestStart + best / 2);
    }
  }
  if (!widths.length) return { width: 0, center: 0.5, skinRatio: 0 };
  const sorted = [...widths].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const cSorted = [...centers].sort((a, b) => a - b);
  return { width: median / width, center: cSorted[Math.floor(cSorted.length / 2)] / width, skinRatio: skin / total };
}

/** Luma stats inside the central guide area (where the face should be). */
export function brightnessStats(px: Pixels): { mean: number; clipped: number } {
  const { width, height, data } = px;
  let sum = 0;
  let n = 0;
  let clipped = 0;
  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.75); y += 2) {
    for (let x = Math.floor(width * 0.25); x < Math.floor(width * 0.75); x += 2) {
      const i = (y * width + x) * 4;
      const l = luma(data[i], data[i + 1], data[i + 2]);
      sum += l;
      n++;
      if (l >= 250) clipped++;
    }
  }
  return { mean: n ? sum / n : 0, clipped: n ? clipped / n : 0 };
}

export function checkQuality(px: Pixels): QualityResult {
  const { mean, clipped } = brightnessStats(px);
  const face = estimateFace(px);
  const issues: QualityIssue[] = [];
  if (mean < MIN_BRIGHTNESS) issues.push("too_dark");
  else if (clipped > MAX_CLIPPED_RATIO) issues.push("too_bright");
  // In the dark the skin classifier is unreliable: report lighting first, don't also claim "no face".
  if (!issues.includes("too_dark")) {
    if (face.skinRatio < 0.05) issues.push("no_face");
    else {
      if (face.width < MIN_FACE_WIDTH) issues.push("face_too_small");
      if (Math.abs(face.center - 0.5) > MAX_OFFSET) issues.push("not_frontal");
    }
  }
  return {
    pass: issues.length === 0,
    issues,
    faceWidth: Math.round(face.width * 100) / 100,
    brightness: Math.round(mean),
    offset: Math.round((face.center - 0.5) * 100) / 100,
  };
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** YouCam rejects small inputs (error_below_min_image_size); SD skin analysis needs short side ≥ 480. */
export const MIN_SHORT_SIDE = 480;
export const MAX_ZOOM = 2;

/**
 * The part of a w×h camera frame that the preview shows: `object-cover` into a box of `aspect`
 * (width/height, 3/4 for the capture box), then a centered digital zoom. Quality checks and the upload
 * use this rect so "face width" means width of what the user sees (a landscape 16:9 stream used to be
 * measured on the full, uncropped frame → face looked ~half as wide).
 */
export function visibleCrop(w: number, h: number, aspect = 3 / 4, zoom = 1): CropRect {
  let sw = w;
  let sh = h;
  if (w / h > aspect) sw = h * aspect;
  else sh = w / aspect;
  const z = Math.max(1, zoom);
  sw /= z;
  sh /= z;
  return { sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh };
}

/** Highest digital zoom that keeps the cropped short side ≥ MIN_SHORT_SIDE (1 = no zoom possible). */
export function maxDigitalZoom(w: number, h: number, aspect = 3 / 4): number {
  const c = visibleCrop(w, h, aspect, 1);
  const z = Math.min(MAX_ZOOM, Math.min(c.sw, c.sh) / MIN_SHORT_SIDE);
  return Math.max(1, Math.floor(z * 10) / 10);
}

/** Long side → 1600 px (plan), and always < 1920 (Makeup VTO limit). */
export function targetSize(width: number, height: number, longSide = 1600): { width: number; height: number } {
  const scale = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
