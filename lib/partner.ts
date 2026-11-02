import { fullFlowCost, revisitFlowCost } from "./units";

/** Data for the /partner concept page: the retailer's view of Mirror Tutor. No invented numbers. */

/** Default per-session unit cap (tests pin it to readConfig). */
export const DEFAULT_SESSION_CAP = 20;

/** The product the fictional page sells (a catalog SKU, so the lesson's lip color is a real match). */
export const PARTNER_SKU = "MT-VT-07";

/** Where the widget is deployed; the snippet on /partner points at it. */
export const EMBED_ORIGIN = "https://mirror-tutor.vercel.app";

/** The integration: a plain iframe on the real /embed/lesson route (no SDK; frame-ancestors is open on /embed only). */
export const INTEGRATION_SNIPPET = `<iframe src="${EMBED_ORIGIN}/embed/lesson?sku=${PARTNER_SKU}"
  title="Learn this look" width="360" height="640"
  style="border:0" loading="lazy"></iframe>`;

/** Swatch palette for "Try your own shade": demo shades, not a partner feed. */
export const PARTNER_SHADES = [
  { hex: "#C6505F", name: { ko: "피그 로즈", en: "Fig Rose" } },
  { hex: "#C94F5E", name: { ko: "새틴 로즈", en: "Satin Rose" } },
  { hex: "#D0425B", name: { ko: "체리", en: "Cherry" } },
  { hex: "#B66C5F", name: { ko: "누드 브릭", en: "Nude Brick" } },
  { hex: "#E8705A", name: { ko: "코랄", en: "Coral" } },
  { hex: "#8E2C4A", name: { ko: "베리", en: "Berry" } },
] as const;

/** Iframe query for a retailer shade: the hex without '#', the name URL-encoded. */
export function embedQuery(shade: { hex: string; name: string } | null): string {
  if (!shade) return `sku=${PARTNER_SKU}`;
  const q = [`hex=${shade.hex.replace(/^#/, "")}`];
  if (shade.name) q.push(`name=${encodeURIComponent(shade.name)}`);
  return q.join("&");
}

/** The copyable snippet for the current demo shade (the default is INTEGRATION_SNIPPET). */
export function integrationSnippet(shade: { hex: string; name: string } | null): string {
  return `<iframe src="${EMBED_ORIGIN}/embed/lesson?${embedQuery(shade)}"
  title="Learn this look" width="360" height="640"
  style="border:0" loading="lazy"></iframe>`;
}

export interface UnitEstimate {
  first: number;
  repeat: number;
  /** Units for the month: first x 14 + repeat x 4, from the same pricing as the unit meter. */
  total: number;
}

/** Cost calculator: both counts are the retailer's inputs (clamped to 0..1,000,000 whole sessions); the unit prices come from the unit guard. No traffic or conversion figure is assumed. */
export function unitEstimate(firstSessions: number, repeatSessions: number, stepCount = 4): UnitEstimate {
  const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, Math.floor(n))) : 0);
  const first = clamp(firstSessions);
  const repeat = clamp(repeatSessions);
  return { first, repeat, total: first * fullFlowCost(stepCount) + repeat * revisitFlowCost(stepCount) };
}

export interface BreakEven {
  /** Monthly YouCam cost in the retailer's currency: units x the unit price they enter. */
  cost: number;
  /** Extra orders per month whose margin alone would cover that cost (rounded up); null when the margin is not a positive number. */
  orders: number | null;
}

/**
 * Illustrative break-even: only arithmetic on the retailer's own inputs (units from the calculator, their contract unit price, their margin per order).
 * It does not assume a conversion lift, a return rate or any price of ours.
 */
export function breakEven(totalUnits: number, unitPrice: number, marginPerOrder: number): BreakEven {
  const units = Number.isFinite(totalUnits) ? Math.max(0, totalUnits) : 0;
  const price = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  const cost = Math.round(units * price * 100) / 100;
  const orders = Number.isFinite(marginPerOrder) && marginPerOrder > 0 ? Math.ceil(cost / marginPerOrder) : null;
  return { cost, orders };
}

export interface UnitMeterRow {
  id: "first" | "next";
  units: number;
}

/** Units per session, derived from the same pricing code the unit guard uses (14 first, 4 after). */
export function unitMeter(stepCount = 4): { rows: UnitMeterRow[]; cap: number } {
  return {
    rows: [
      { id: "first", units: fullFlowCost(stepCount) },
      { id: "next", units: revisitFlowCost(stepCount) },
    ],
    cap: DEFAULT_SESSION_CAP,
  };
}

/** KPIs to measure. Names only: the page shows "no data yet" for each, never a made-up value. */
export const PARTNER_KPIS = ["partnerKpi1", "partnerKpi2", "partnerKpi3"] as const;
