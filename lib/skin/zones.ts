import type { Pt } from "../grade/landmarks";
import type { SkinConcernKey } from "./concerns";

/**
 * Skin zones drawn on the photo: each Skin Analysis concern is mapped to the face area it is about, from the same landmark
 * mesh (MediaPipe canonical, on this device) as the pins. The areas are fixed landmark shapes, NOT a per-pixel detection by
 * the API: Skin Analysis returns one score per concern, so the UI says "zones approximate, from landmarks".
 * Pure + isomorphic. Coordinates are normalized 0..1 in the 600x800 (3:4) photo.
 */
export type SkinZones = Record<SkinConcernKey, Pt[][]>;
export interface ZoneView {
  x: number;
  y: number;
  w: number;
  h: number;
}

const W = 600;
const H = 800;
const MESH_SIZE = 468;
const NEED = [33, 133, 362, 263, 7, 163, 144, 145, 153, 154, 155, 249, 390, 373, 374, 380, 381, 382, 205, 425, 4, 168, 9, 10];
const r4 = (n: number) => Math.round(n * 10000) / 10000;

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Ellipse around `c` with pixel radii (in the 600x800 photo) so a circle stays a circle on screen. */
function ellipse(c: Pt, rxPx: number, ryPx: number, n = 20): Pt[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return { x: r4(c.x + (Math.cos(a) * rxPx) / W), y: r4(c.y + (Math.sin(a) * ryPx) / H) };
  });
}

/** Band under one eye: the lower-lid curve and the same curve pushed down by `dropPx`. */
function underEye(f: Pt[], idx: number[], dropPx: number): Pt[] {
  const top = idx.map((i) => f[i]);
  const bottom = top.map((p) => ({ x: p.x, y: p.y + dropPx / H })).reverse();
  return [...top, ...bottom].map((p) => ({ x: r4(p.x), y: r4(p.y) }));
}

const EYE_A = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const EYE_B = [362, 382, 381, 380, 374, 373, 390, 249, 263];

export function skinZonesFromLandmarks(f: Pt[]): SkinZones | null {
  if (f.length < MESH_SIZE || !NEED.every((i) => f[i] && Number.isFinite(f[i].x) && Number.isFinite(f[i].y))) return null;
  const io = Math.abs(mid(f[362], f[263]).x - mid(f[33], f[133]).x) * W; // distance between the eye centers, px
  if (!(io > 20)) return null;
  const drop = io * 0.3;
  const noseLen = Math.abs(f[4].y - f[168].y) * H;
  const nose = mid(f[4], f[168]);
  const foreheadH = Math.max(Math.abs(f[9].y - f[10].y) * H, io * 0.25);
  return {
    dark_circle: [underEye(f, EYE_A, drop), underEye(f, EYE_B, drop)],
    redness: [ellipse(f[205], io * 0.3, io * 0.24), ellipse(f[425], io * 0.3, io * 0.24)],
    pores: [ellipse(nose, io * 0.2, noseLen * 0.58)],
    oiliness: [ellipse(mid(f[9], f[10]), io * 0.46, foreheadH * 0.34), ellipse(mid(f[168], f[4]), io * 0.08, noseLen * 0.55)],
  };
}

/** Crop window around the given zones with the on-screen aspect (w/h), padded and kept inside the photo. */
export function zonesView(zones: Pt[][], screenAspect = 1.1): ZoneView {
  const pts = zones.flat();
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // normalized -> px space for the aspect maths
  let wPx = Math.max((x1 - x0) * W * 1.7, 160);
  let hPx = Math.max((y1 - y0) * H * 1.7, 120);
  if (wPx / hPx < screenAspect) wPx = hPx * screenAspect;
  else hPx = wPx / screenAspect;
  if (wPx > W) {
    wPx = W;
    hPx = W / screenAspect;
  }
  if (hPx > H) {
    hPx = H;
    wPx = H * screenAspect;
  }
  const cx = ((x0 + x1) / 2) * W, cy = ((y0 + y1) / 2) * H;
  const x = Math.max(0, Math.min(W - wPx, cx - wPx / 2));
  const y = Math.max(0, Math.min(H - hPx, cy - hPx / 2));
  return { x: x / W, y: y / H, w: wPx / W, h: hPx / H };
}
