import type { Pt } from "./grade/landmarks";

/**
 * Callout layout on an object-fit: cover photo (M2 attribute pins, M4 score labels). Pure; kept apart from
 * lib/facePins so the pages don't bundle the landmark polygons.
 */

export interface Size {
  w: number;
  h: number;
}

export interface CoverFit {
  scale: number;
  /** image top-left offset inside the box (≤ 0 on the cropped axis) */
  dx: number;
  dy: number;
  /** CSS object-position that produces dx/dy */
  objectPosition: string;
}

/** object-fit: cover, shifted so `focus` (normalized image point) is as close to the box center as the crop allows. */
export function coverFit(img: Size, box: Size, focus: Pt = { x: 0.5, y: 0.5 }): CoverFit {
  const scale = Math.max(box.w / img.w, box.h / img.h);
  const axis = (boxLen: number, imgLen: number, f: number) => {
    const free = boxLen - imgLen * scale; // ≤ 0
    if (free > -1e-6) return { off: free / 2, pos: 0.5 };
    const off = Math.min(0, Math.max(free, boxLen / 2 - f * imgLen * scale));
    return { off, pos: off / free };
  };
  const x = axis(box.w, img.w, focus.x);
  const y = axis(box.h, img.h, focus.y);
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  return { scale, dx: x.off, dy: y.off, objectPosition: `${pct(x.pos)} ${pct(y.pos)}` };
}

/** Normalized image point → px inside the box. */
export function mapToBox(p: Pt, img: Size, fit: CoverFit): Pt {
  return { x: fit.dx + p.x * img.w * fit.scale, y: fit.dy + p.y * img.h * fit.scale };
}

/** Conservative width of a one-line bold label chip (Hangul ≈ 1em, Latin ≈ 0.6em) incl. horizontal padding. */
export function estimateLabelWidth(text: string, fontPx = 12, padX = 8): number {
  let em = 0;
  for (const ch of text) {
    if (/[ᄀ-ᇿ㄰-㆏가-힯　-鿿]/.test(ch)) em += 1;
    else if (ch === " ") em += 0.3;
    else if (/[A-Z0-9]/.test(ch)) em += 0.68;
    else if (/[a-z]/.test(ch)) em += 0.58;
    else em += 0.45;
  }
  return Math.ceil(em * fontPx * 1.06 + padX * 2);
}

export type LabelSide = "left" | "right" | "center";

export interface PinInput {
  id: string;
  /** px inside the box */
  at: Pt;
  /** label size px */
  w: number;
  h: number;
  prefer: LabelSide;
}

export interface PinPlacement {
  id: string;
  dot: Pt;
  label: { x: number; y: number; w: number; h: number };
  side: LabelSide;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PinOptions {
  margin?: number;
  dotR?: number;
  gap?: number;
  /** areas labels must not cover (e.g. a status chip on the photo) */
  avoid?: Rect[];
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Places dot + label chips inside the box: points outside the visible crop are dropped (never moved onto the
 * face), dots are kept `margin + dotR` from the edges, labels flip side when they would overflow, are clamped
 * inside, and are nudged vertically when they collide with an earlier label.
 */
export function placePins(pins: PinInput[], box: Size, opts: PinOptions = {}): PinPlacement[] {
  const margin = opts.margin ?? 6;
  const dotR = opts.dotR ?? 5;
  const gap = opts.gap ?? 4;
  const clamp = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
  const out: PinPlacement[] = [];
  for (const p of pins) {
    if (!(p.at.x >= 0 && p.at.x <= box.w && p.at.y >= 0 && p.at.y <= box.h)) continue;
    const w = Math.min(p.w, box.w - margin * 2);
    const h = Math.min(p.h, box.h - margin * 2);
    const inset = p.prefer === "center" ? margin : margin + dotR;
    const dot = { x: clamp(p.at.x, inset, box.w - inset), y: clamp(p.at.y, inset, box.h - inset) };
    const leftX = dot.x - dotR - gap - w;
    const rightX = dot.x + dotR + gap;
    // a side "fits" if the clamped label still clears the dot (the gap may shrink near an edge)
    const fitsLeft = margin + w <= dot.x - dotR - 1;
    const fitsRight = box.w - margin - w >= dot.x + dotR + 1;
    let side: LabelSide = p.prefer;
    let x: number;
    if (p.prefer === "center") x = dot.x - w / 2;
    else {
      if (side === "left" && !fitsLeft && fitsRight) side = "right";
      else if (side === "right" && !fitsRight && fitsLeft) side = "left";
      else if (!fitsLeft && !fitsRight) side = dot.x > box.w / 2 ? "left" : "right";
      x = side === "left" ? leftX : rightX;
    }
    const label = { x: clamp(x, margin, box.w - margin - w), y: clamp(dot.y - h / 2, margin, box.h - margin - h), w, h };
    const obstacles = [...(opts.avoid ?? []), ...out.map((o) => o.label)];
    for (let pass = 0; pass < 3; pass++) {
      const hit = obstacles.find((o) => overlaps(label, o));
      if (!hit) break;
      const below = hit.y + hit.h + gap;
      const above = hit.y - h - gap;
      const fitsBelow = below + h <= box.h - margin;
      const fitsAbove = above >= margin;
      // move toward the pin's own side of the obstacle (a lid label above an eye label stays above)
      const up = dot.y < hit.y + hit.h / 2 ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
      label.y = up ? clamp(above, margin, box.h - margin - h) : below;
    }
    out.push({ id: p.id, dot, label, side });
  }
  return out;
}

/** Top corner for a status badge: top-right unless a dot would sit under it (then top-left, if that is clear). */
export function badgeCorner(dots: Pt[], box: Size, w: number, h: number, inset = 8, pad = 8): "top-left" | "top-right" {
  const covers = (x: number) => dots.some((d) => d.x >= x - pad && d.x <= x + w + pad && d.y >= inset - pad && d.y <= inset + h + pad);
  return covers(box.w - inset - w) && !covers(inset) ? "top-left" : "top-right";
}
