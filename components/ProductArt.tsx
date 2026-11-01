import { useId } from "react";

/**
 * Shop-the-step product visual: an original, brand-neutral line illustration per category, tinted with the
 * catalog shade(s). No logos, no photos, no network images — the hex stays the source of truth.
 */
export type ProductArtKind = "tint" | "cushion" | "blush" | "palette" | "pencil" | "gel" | "swatch";

const KIND: Record<string, ProductArtKind> = {
  lip_color: "tint",
  foundation: "cushion",
  blush: "blush",
  eye_shadow: "palette",
  eyebrows: "pencil",
  eye_liner: "gel",
};

export function productArtKind(category: string): ProductArtKind {
  return KIND[category] ?? "swatch";
}

// packaging neutrals (not brand colors)
const CASE = "#EFE8E3";
const CASE_EDGE = "#D9CEC7";
const CAP = "#2E2826";
const SHINE = "#FFFFFF";

export function ProductArt({ category, shades, texture, className = "h-20 w-20" }: { category: string; shades: string[]; texture?: string | null; className?: string }) {
  const kind = productArtKind(category);
  const a = shades[0] ?? "#CCCCCC";
  const b = shades[1] ?? a;
  const glossy = texture === "gloss";
  const gid = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden data-kind={kind}>
      <defs>
        <linearGradient id={`${gid}-sheen`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={SHINE} stopOpacity="0.55" />
          <stop offset="0.5" stopColor={SHINE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {kind === "tint" && (
        <g transform="rotate(-14 40 42)">
          {/* translucent tube showing the shade, dark cap */}
          <rect x="29" y="30" width="22" height="40" rx="6" fill={a} />
          <rect x="29" y="30" width="22" height="40" rx="6" fill={`url(#${gid}-sheen)`} />
          <rect x="32" y="34" width="4" height="30" rx="2" fill={SHINE} opacity={glossy ? 0.7 : 0.25} />
          <rect x="31" y="27" width="18" height="5" rx="1.5" fill={CASE_EDGE} />
          <rect x="30" y="6" width="20" height="23" rx="4" fill={CAP} />
          <rect x="33" y="9" width="3" height="16" rx="1.5" fill={SHINE} opacity="0.18" />
        </g>
      )}
      {kind === "cushion" && (
        <g>
          {/* open compact: lid behind, pan with the shade, puff edge */}
          <ellipse cx="40" cy="25" rx="27" ry="13" fill={CASE_EDGE} />
          <ellipse cx="40" cy="25" rx="21" ry="9" fill={CASE} />
          <circle cx="40" cy="50" r="25" fill={CASE} stroke={CASE_EDGE} strokeWidth="2" />
          <circle cx="40" cy="50" r="18" fill={a} />
          <circle cx="40" cy="50" r="18" fill={`url(#${gid}-sheen)`} />
          <path d="M27 60a18 18 0 0 0 26 0" fill="none" stroke={CAP} strokeOpacity="0.12" strokeWidth="2" />
        </g>
      )}
      {kind === "blush" && (
        <g>
          <rect x="13" y="13" width="54" height="54" rx="14" fill={CASE} stroke={CASE_EDGE} strokeWidth="2" />
          <circle cx="40" cy="40" r="19" fill={a} />
          {/* pressed-powder relief */}
          <g fill="none" stroke={SHINE} strokeOpacity="0.45" strokeWidth="1.4">
            <path d="M40 25c5 6 5 24 0 30M40 25c-5 6-5 24 0 30" />
            <path d="M25 40c6-5 24-5 30 0M25 40c6 5 24 5 30 0" />
          </g>
          <circle cx="40" cy="40" r="19" fill={`url(#${gid}-sheen)`} />
        </g>
      )}
      {kind === "palette" && (
        <g>
          <rect x="8" y="20" width="64" height="40" rx="9" fill={CASE} stroke={CASE_EDGE} strokeWidth="2" />
          <rect x="14" y="26" width="24" height="28" rx="5" fill={a} />
          <rect x="42" y="26" width="24" height="28" rx="5" fill={b} />
          <rect x="14" y="26" width="24" height="28" rx="5" fill={`url(#${gid}-sheen)`} />
          <rect x="42" y="26" width="24" height="28" rx="5" fill={`url(#${gid}-sheen)`} />
        </g>
      )}
      {kind === "pencil" && (
        <g transform="rotate(-38 40 40)">
          <rect x="6" y="35" width="46" height="10" rx="2" fill={CAP} />
          <rect x="6" y="35" width="8" height="10" rx="2" fill={a} />
          <rect x="16" y="36.5" width="30" height="1.6" rx="0.8" fill={SHINE} opacity="0.2" />
          <path d="M52 35l14 5-14 5z" fill="#E6CDB0" />
          <path d="M61 38.2l6 1.8-6 1.8z" fill={a} />
        </g>
      )}
      {kind === "gel" && (
        <g>
          {/* jar with the gel visible, angled brush */}
          <rect x="16" y="40" width="40" height="24" rx="5" fill={CASE} stroke={CASE_EDGE} strokeWidth="2" />
          <ellipse cx="36" cy="40" rx="20" ry="7" fill={CASE_EDGE} />
          <ellipse cx="36" cy="40" rx="16" ry="5" fill={a} />
          <ellipse cx="32" cy="38.6" rx="6" ry="1.4" fill={SHINE} opacity="0.35" />
          <g transform="rotate(-50 58 30)">
            <rect x="40" y="28.5" width="30" height="3" rx="1.5" fill={CAP} />
            <path d="M70 28.5h5l2 1.5-2 1.5h-5z" fill={a} />
          </g>
        </g>
      )}
      {kind === "swatch" && (
        <g>
          {shades.slice(0, 3).map((h, i, arr) => (
            <rect key={h + i} x={8 + (i * 64) / arr.length} y="16" width={64 / arr.length} height="48" fill={h} />
          ))}
        </g>
      )}
    </svg>
  );
}
