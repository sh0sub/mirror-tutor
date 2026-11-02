import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_SESSION_CAP, INTEGRATION_SNIPPET, PARTNER_KPIS, PARTNER_SKU, unitEstimate, unitMeter } from "@/lib/partner";
import { readConfig } from "@/lib/config";
import { PRODUCTS } from "@/lib/shop";
import { MESSAGES, t } from "@/lib/i18n";

describe("/partner concept page data", () => {
  it("unit meter shows 14 for the first lesson, then 4, under the real session cap", () => {
    const m = unitMeter();
    expect(m.rows).toEqual([
      { id: "first", units: 14 },
      { id: "next", units: 4 },
    ]);
    expect(m.cap).toBe(readConfig({}).sessionCap);
    expect(DEFAULT_SESSION_CAP).toBe(20);
  });

  it("the snippet names a real catalog SKU and the page says no SDK is published", () => {
    expect(PRODUCTS.some((p) => p.sku === PARTNER_SKU && p.category === "lip_color")).toBe(true);
    expect(INTEGRATION_SNIPPET).toContain(PARTNER_SKU);
    expect(t("partnerSnippetNote", "en")).toMatch(/no published SDK/i);
  });

  it("KPIs are hypotheses with no numbers", () => {
    expect(PARTNER_KPIS).toHaveLength(3);
    for (const k of PARTNER_KPIS) {
      for (const lang of ["ko", "en"] as const) {
        expect(t(k, lang)).not.toMatch(/\d/);
        expect(t(`${k}Body` as "partnerKpi1Body", lang)).not.toMatch(/\d+\s?%/);
      }
    }
    expect(MESSAGES.partnerKpiHypothesis.en).toMatch(/hypothesis/i);
  });

  it("the favicon asset exists", () => {
    expect(readFileSync("app/icon.svg", "utf8")).toContain("<svg");
  });

  it("cost calculator is inputs x the real unit prices, clamped, with no assumed traffic", () => {
    expect(unitEstimate(1000, 500)).toEqual({ first: 1000, repeat: 500, total: 1000 * 14 + 500 * 4 });
    expect(unitEstimate(-5, Number.NaN).total).toBe(0);
    expect(unitEstimate(1e12, 0).first).toBe(1_000_000);
  });
});
