import { fullFlowCost, revisitFlowCost } from "./units";

/** Data for the /partner concept page: the retailer's view of Mirror Tutor. No invented numbers. */

/** Default per-session unit cap (tests pin it to readConfig). */
export const DEFAULT_SESSION_CAP = 20;

/** The product the fictional page sells (a catalog SKU, so the lesson's lip color is a real match). */
export const PARTNER_SKU = "MT-VT-07";

/** One-line integration shape. Illustrative: no SDK is published yet (the page says so). */
export const INTEGRATION_SNIPPET = `<script src="https://widget.example-retailer.com/mirror-tutor.js"
  data-lesson="daily-k" data-sku="${PARTNER_SKU}" async></script>`;

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
