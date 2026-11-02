import type { Pt } from "./grade/landmarks";
import type { Eyelid } from "./profile";

/**
 * C18 "Show technique": the lid area, crease guide and gradient direction drawn from face landmarks (MediaPipe canonical
 * mesh). Pure + isomorphic. Coordinates are normalized 0..1 in the 600x800 (3:4) photo. The lid band and crease are the
 * landmark rings above the lash line (approximate, not a measured crease); the arrows are this app's rule-table direction.
 */
export type GradientDir = "horizontal" | "vertical";

export interface EyeOverlayEye {
  /** shadow zone above the lash line (landmark band) */
  lid: Pt[];
  /** upper edge of that band, where a double lid's crease sits (a guide, not a measurement) */
  crease: Pt[];
  /** gradient direction arrows (from → to) */
  arrows: Record<GradientDir, { from: Pt; to: Pt }>;
}
export interface EyeOverlay {
  /** image-left eye first */
  eyes: EyeOverlayEye[];
}
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rule table: a monolid has no fold to stop at, so the shadow spreads sideways; every other lid shades up toward the crease. */
export function techniqueDir(eyelid: Eyelid): GradientDir {
  return eyelid === "monolid" ? "horizontal" : "vertical";
}

const MESH_SIZE = 468;
// [outer corner, inner corner, upper lid, lower lid, lid band, crease (band's upper edge)] per eye of the canonical mesh
const EYES = [
  { o: 33, i: 133, u: 159, l: 145, lid: [130, 247, 30, 29, 27, 28, 56, 190, 243, 244, 189, 221, 222, 223, 224, 225, 113], crease: [244, 189, 221, 222, 223, 224, 225, 113] },
  { o: 263, i: 362, u: 386, l: 374, lid: [359, 467, 260, 259, 257, 258, 286, 414, 463, 464, 413, 441, 442, 443, 444, 445, 342], crease: [464, 413, 441, 442, 443, 444, 445, 342] },
] as const;

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const rp = (p: Pt): Pt => ({ x: r4(p.x), y: r4(p.y) });

/** `aspect` = photo width / height (0.75), so the vertical arrow is as long on screen as the horizontal one. */
export function eyeOverlayFromLandmarks(f: Pt[], aspect = 0.75): EyeOverlay | null {
  const need = EYES.flatMap((e) => [e.o, e.i, e.u, e.l, ...e.lid]);
  if (f.length < MESH_SIZE || !need.every((i) => f[i] && Number.isFinite(f[i].x) && Number.isFinite(f[i].y))) return null;
  const eyes = EYES.map((e) => {
    const o = f[e.o], i = f[e.i], u = f[e.u], l = f[e.l];
    const ew = Math.abs(i.x - o.x);
    const y = u.y - (l.y - u.y) * 0.55; // along the lid, a little above the lash line
    const mx = (o.x + i.x) / 2;
    return {
      lid: e.lid.map((k) => rp(f[k])),
      crease: e.crease.map((k) => rp(f[k])),
      arrows: {
        horizontal: { from: rp({ x: o.x + (o.x < i.x ? -0.01 : 0.01), y }), to: rp({ x: i.x, y }) },
        vertical: { from: rp({ x: mx, y: u.y - 0.005 }), to: rp({ x: mx, y: u.y - (ew * 0.42) / aspect }) },
      },
    };
  });
  return { eyes };
}

/** Bounding box of both eyes' lid bands. */
export function overlayBox(o: EyeOverlay): View {
  const pts = o.eyes.flatMap((e) => [...e.lid, e.arrows.horizontal.from, e.arrows.horizontal.to, e.arrows.vertical.to]);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Eye close-up window around both eyes with the given on-screen aspect (w/h), padded and kept inside the photo. */
export function closeupView(o: EyeOverlay, screenAspect = 2, photoAspect = 0.75): View {
  const b = overlayBox(o);
  const w = Math.min(1, b.w * 1.25);
  const h = Math.min(1, (w * photoAspect) / screenAspect);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + b.h * 0.05;
  return { x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - h, cy - h / 2)), w, h };
}
