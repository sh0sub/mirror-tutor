import type { EyeOverlay, GradientDir, View } from "@/lib/eyeOverlay";
import type { Pt } from "@/lib/grade/landmarks";

const W = 600;
const H = 800;
const ACCENT = "#c8325b";
const P = (p: Pt) => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`;
const line = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${P(p)}`).join("");

function arrowPath(from: Pt, to: Pt, headPx: number) {
  const a = Math.atan2((to.y - from.y) * H, (to.x - from.x) * W);
  const wing = (s: number) => `M${P(to)}l${(-headPx * Math.cos(a + s)).toFixed(1)},${(-headPx * Math.sin(a + s)).toFixed(1)}`;
  return `M${P(from)}L${P(to)}${wing(0.5)}${wing(-0.5)}`;
}

/**
 * Landmark overlay: lid band (dashed), crease guide (double lids only, a monolid has none to stop at) and the gradient
 * direction arrow. Drawn in photo space (600x800) so it can sit on a full 3:4 face (view omitted), on a cropped box
 * (view = the visible window, same aspect as the box) or inside EyeCloseup. Decorative: the text next to it says the same.
 */
export function EyeOverlaySvg({ overlay, dir, crease, view, head = 15, className = "", withViewBox = true }: {
  overlay: EyeOverlay;
  dir: GradientDir;
  /** draw the crease guide (double / inner-double / hooded lids) */
  crease: boolean;
  view?: View;
  /** arrow head length in photo px (grow it for small faces) */
  head?: number;
  className?: string;
  withViewBox?: boolean;
}) {
  const v = view ?? { x: 0, y: 0, w: 1, h: 1 };
  const body = (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" data-technique-overlay={dir}>
      {overlay.eyes.map((e, i) => (
        <g key={i}>
          <path d={`${line(e.lid)}Z`} fill="rgba(200,50,91,0.22)" stroke="#fff" strokeWidth={1.6} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          {crease && <path d={line(e.crease)} stroke="rgba(0,0,0,0.55)" strokeWidth={4.5} vectorEffect="non-scaling-stroke" />}
          {crease && <path d={line(e.crease)} stroke="#fff" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />}
          <path d={arrowPath(e.arrows[dir].from, e.arrows[dir].to, head)} stroke="#fff" strokeWidth={5} vectorEffect="non-scaling-stroke" />
          <path d={arrowPath(e.arrows[dir].from, e.arrows[dir].to, head)} stroke={ACCENT} strokeWidth={2.6} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </g>
  );
  if (!withViewBox) return body;
  return (
    <svg viewBox={`${v.x * W} ${v.y * H} ${v.w * W} ${v.h * H}`} preserveAspectRatio="none" aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      {body}
    </svg>
  );
}

/** Eye-band crop of a 600x800 render with the overlay on top (the proof at phone size). */
export function EyeCloseup({ src, alt, overlay, dir, crease, show, view }: { src: string; alt: string; overlay: EyeOverlay; dir: GradientDir; crease: boolean; show: boolean; view: View }) {
  return (
    <svg viewBox={`${view.x * W} ${view.y * H} ${view.w * W} ${view.h * H}`} role="img" aria-label={alt} className="block h-auto w-full" style={{ aspectRatio: `${view.w * W} / ${view.h * H}` }}>
      <image href={src} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
      {show && <EyeOverlaySvg overlay={overlay} dir={dir} crease={crease} withViewBox={false} head={9} />}
    </svg>
  );
}
