import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EXAMPLE_FIRST_SESSIONS, EXAMPLE_REPEAT_SESSIONS, DEFAULT_SESSION_CAP, INTEGRATION_SNIPPET, PARTNER_KPIS, PARTNER_SKU, breakEven, sampleSizePerArm, testUnitCeiling, TEST_BASELINE, TEST_LIFT, unitEstimate, unitMeter } from "@/lib/partner";
import { readConfig } from "@/lib/config";
import { PRODUCTS } from "@/lib/shop";
import { MESSAGES, t } from "@/lib/i18n";

describe("/partner concept page data", () => {
  it("unit meter shows 14 for the first lesson, then 4, under the real session cap", () => {
    const m = unitMeter();
    expect(m.rows).toEqual([
      { id: "first", units: 14 },
      { id: "next", units: 4 },
      { id: "skin", units: 9 },
    ]);
    expect(m.cap).toBe(readConfig({}).sessionCap);
    expect(DEFAULT_SESSION_CAP).toBe(24);
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

  it("break-even is plain arithmetic on the retailer's inputs, with no assumed lift", () => {
    expect(breakEven(16_000, 0.05, 6)).toEqual({ cost: 800, orders: 134 });
    expect(breakEven(16_000, 0.05, 0).orders).toBeNull();
    expect(breakEven(Number.NaN, -1, 5)).toEqual({ cost: 0, orders: 0 });
  });

  it("the worked example at the top is 2,000 first + 6,000 repeat = 52,000 units, with no assumed price", () => {
    expect(unitEstimate(EXAMPLE_FIRST_SESSIONS, EXAMPLE_REPEAT_SESSIONS).total).toBe(52_000);
    const page = readFileSync("app/(flow)/partner/page.tsx", "utf8");
    expect(page.indexOf('data-testid="store-strip"')).toBeLessThan(page.indexOf('data-testid="partner-example"'));
    for (const lang of ["ko", "en"] as const) expect(t("partnerExampleBreak", lang)).not.toMatch(/\$|원\s*\d|0\.05/);
  });

  it("the two-week test: n = 16p(1-p)/d^2, about 6,100 per arm at 4% and 1 pt, labelled a plan", () => {
    expect(sampleSizePerArm(TEST_BASELINE, TEST_LIFT)).toBe(6144);
    expect(sampleSizePerArm(0, 0.01)).toBe(0);
    expect(sampleSizePerArm(0.04, 0)).toBe(0);
    expect(testUnitCeiling(6144)).toBe(6144 * 14);
    for (const lang of ["ko", "en"] as const) {
      expect(t("partnerTestTag", lang)).toBeTruthy();
      expect(t("partnerTestNote", lang)).toMatch(lang === "en" ? /not measured/ : /측정값이 아니/);
    }
    expect(MESSAGES.partnerTestTag.en).toMatch(/plan, not a result/i);
    const page = readFileSync("app/(flow)/partner/page.tsx", "utf8");
    expect(page.indexOf('data-testid="partner-example"')).toBeLessThan(page.indexOf('data-testid="retailer-test"'));
    expect(page).toContain('scrolling="no"');
  });
});

describe("C23 copy: jump chips, monolid reframe, step-3 card prefix, shop next steps", () => {
  it("has bilingual jump/next labels and keeps the 'plan, not a result' tag", () => {
    for (const k of ["partnerJumpCalc", "partnerJumpTest", "partnerJumpSnippet", "shopShareLink", "shopRetailerLink", "lessonFixCardPrefix"] as const) {
      expect(t(k, "en").length).toBeGreaterThan(2);
      expect(t(k, "ko").length).toBeGreaterThan(1);
    }
    expect(t("partnerTestTag", "en")).toBe("A plan, not a result");
  });
  it("reframes the monolid chip as a feature but keeps the honest misread notice", () => {
    expect(t("sampleMonoHint", "en")).toBe("Correct what the analyzer cannot see");
    expect(t("sampleMonoFix", "en")).toMatch(/Caught a misread: Face Analyzer said Double lid, your eyes are monolid/);
    expect(t("lessonFixCardPrefix", "en")).toBe("Analyzer misread you can fix:");
  });
});
