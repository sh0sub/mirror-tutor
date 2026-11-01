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
