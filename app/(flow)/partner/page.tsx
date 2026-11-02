"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AppBar,
  Button,
  ButtonLink,
  Chip,
  Icon,
  Screen,
  Swatch,
} from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { PRODUCTS } from "@/lib/shop";
import {
  EXAMPLE_FIRST_SESSIONS,
  EXAMPLE_REPEAT_SESSIONS,
  PARTNER_KPIS,
  PARTNER_SHADES,
  PARTNER_SKU,
  TEST_BASELINE,
  TEST_LIFT,
  breakEven,
  embedQuery,
  integrationSnippet,
  sampleSizePerArm,
  testUnitCeiling,
  unitEstimate,
  unitMeter,
} from "@/lib/partner";
import { EMBED_NAME_MAX, customProduct, parseCustomShade } from "@/lib/embed";

const demoProduct = PRODUCTS.find((p) => p.sku === PARTNER_SKU)!;
const meter = unitMeter();
const testPerArm = sampleSizePerArm(TEST_BASELINE, TEST_LIFT);

/** Concept screen for the buyer (a beauty retailer): the lesson widget on a fictional product page, the integration line, the unit cost and the KPIs to measure. */
export default function PartnerPage() {
  const { lang, startSample } = useFlow();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hexInput, setHexInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [first, setFirst] = useState(String(EXAMPLE_FIRST_SESSIONS));
  const [repeat, setRepeat] = useState(String(EXAMPLE_REPEAT_SESSIONS));
  const shade = parseCustomShade(hexInput, nameInput);
  const hexBad = hexInput.trim() !== "" && !shade;
  const product = shade ? customProduct(shade) : demoProduct;
  const estimate = unitEstimate(Number(first), Number(repeat));
  const [price, setPrice] = useState("0.05");
  const [margin, setMargin] = useState("6");
  const be = breakEven(estimate.total, Number(price), Number(margin));
  const example = unitEstimate(EXAMPLE_FIRST_SESSIONS, EXAMPLE_REPEAT_SESSIONS);
  const fmt = (n: number) =>
    n.toLocaleString(lang === "ko" ? "ko-KR" : "en-US");
  const maxUnits = Math.max(...meter.rows.map((r) => r.units), meter.cap);

  const trySample = async () => {
    setBusy(true);
    try {
      await startSample();
      router.push("/analyze");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen wide>
      <AppBar title={t("partnerTitle", lang)} backHref="/" />
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-start lg:gap-x-10 lg:px-6">
        <div
          className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1"
          data-testid="partner-hero"
        >
          <Chip tone="warn" icon="info" wrap>
            {t("partnerConcept", lang)}
          </Chip>
          <h1 className="max-w-[640px] text-[26px] font-extrabold leading-tight lg:text-[34px]">
            {t("partnerHero", lang)}
          </h1>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-muted">
            {t("partnerHeroSub", lang)}
          </p>
          <ul
            className="flex flex-wrap gap-2"
            aria-label={t("partnerApisTitle", lang)}
            data-testid="partner-apis"
          >
            {(["partnerApi1", "partnerApi2", "partnerApi3"] as const).map(
              (key) => (
                <li key={key}>
                  <Chip tone="accent" wrap>
                    {t(key, lang)}
                  </Chip>
                </li>
              ),
            )}
          </ul>
        </div>

        {/* fictional product page with the embedded widget */}
        <section
          aria-label="MT Select"
          className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-panel p-4 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <div className="flex items-center gap-4">
            <ProductArt
              category={product.category}
              shades={product.shades}
              texture={product.texture}
              className="h-24 w-24 flex-none"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs font-bold text-muted">MT Select</p>
              <h2 className="text-[17px] font-extrabold leading-snug">
                {product.name[lang].replace(/^MT Select\s*/, "")}
              </h2>
              {!shade && (
                <p className="num text-sm font-bold">
                  {lang === "ko"
                    ? `${product.priceKrw.toLocaleString("ko-KR")}원`
                    : `$${product.priceUsd}`}
                </p>
              )}
              {shade && (
                <p className="num text-sm font-bold text-muted">{shade.hex}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" className="w-full" disabled>
            <Icon name="bag" className="h-4 w-4" />
            {t("partnerAddToCart", lang)}
          </Button>

          <div
            data-testid="partner-widget"
            className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-canvas p-2"
          >
            <p className="flex items-center gap-2 px-1 pt-1 text-sm font-extrabold text-primary-strong">
              <Icon name="sparkle" className="h-4 w-4" />
              {t("partnerWidgetTitle", lang)}
            </p>
            <iframe
              src={`/embed/lesson?${embedQuery(shade)}&lang=${lang}`}
              title={t("partnerWidgetTitle", lang)}
              scrolling="no"
              className="mx-auto h-[640px] w-full max-w-[360px] overflow-hidden rounded-xl border-0"
              loading="lazy"
            />
            <Button className="w-full" onClick={trySample} disabled={busy}>
              {t("partnerWidgetCta", lang)}
            </Button>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2">
          <p className="max-w-[640px] text-xs leading-relaxed text-muted">
            {t("partnerNoPilot", lang)}
          </p>
          <section
            aria-labelledby="store-flow"
            className="flex min-w-0 flex-col gap-3"
            data-testid="store-strip"
          >
            <h2 id="store-flow" className="text-[17px] font-extrabold">
              {t("partnerStoreTitle", lang)}
            </h2>
            <ol className="grid grid-cols-1 gap-2">
              {(
                ["partnerStore1", "partnerStore2", "partnerStore3"] as const
              ).map((key, i) => (
                <li
                  key={key}
                  className="flex items-start gap-3 rounded-[var(--radius-panel)] bg-panel p-3"
                >
                  <span
                    className="num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-sm font-extrabold text-on-primary"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-extrabold">
                      {t(key, lang)}
                    </span>
                    <span className="text-xs leading-relaxed text-muted">
                      {t(`${key}Body` as "partnerStore1Body", lang)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="try-shade"
            className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4"
            data-testid="try-shade"
          >
            <h2 id="try-shade" className="text-[17px] font-extrabold">
              {t("partnerTryTitle", lang)}
            </h2>
            <p className="text-xs text-muted">{t("partnerTryNote", lang)}</p>
            <div
              role="group"
              aria-label={t("partnerTryPalette", lang)}
              className="flex flex-wrap gap-1.5"
            >
              {PARTNER_SHADES.map((c) => (
                <Swatch
                  key={c.hex}
                  hex={c.hex}
                  selected={shade?.hex === c.hex}
                  label={`${c.name[lang]} ${c.hex}`}
                  onClick={() => {
                    setHexInput(c.hex);
                    setNameInput(c.name[lang]);
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t("partnerTryHex", lang)}
                <input
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  inputMode="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={7}
                  placeholder="C94F5E"
                  aria-invalid={hexBad}
                  aria-describedby={hexBad ? "hex-bad" : undefined}
                  className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t("partnerTryName", lang)}
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={EMBED_NAME_MAX}
                  className="min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium"
                />
              </label>
            </div>
            {hexBad && (
              <p
                id="hex-bad"
                role="alert"
                className="text-xs font-bold text-danger"
              >
                {t("partnerTryHexBad", lang)}
              </p>
            )}
            {shade && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setHexInput("");
                  setNameInput("");
                }}
              >
                {t("partnerTryReset", lang)}
              </Button>
            )}
          </section>
        </div>

        <details
          id="cost-calculator"
          className="group scroll-mt-20 min-w-0 rounded-[var(--radius-panel)] bg-panel lg:col-span-2"
          data-testid="partner-cost"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-col">
              <span className="text-[17px] font-extrabold">
                {t("partnerAccCost", lang)}
              </span>
              <span className="num text-xs font-medium text-muted">
                {tf("partnerExampleTotal", lang, { n: fmt(example.total) })} ·{" "}
                {t("partnerAccCostSub", lang)}
              </span>
            </span>
            <Icon
              name="back"
              className="h-4 w-4 flex-none -rotate-90 text-muted transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div
              className="flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-panel)] border-2 border-primary/30 bg-canvas p-4"
              data-testid="partner-example"
            >
              <p className="text-xs font-bold text-primary-strong">
                {t("partnerExampleTitle", lang)}
              </p>
              <p className="num text-3xl font-extrabold leading-tight">
                {tf("partnerExampleTotal", lang, { n: fmt(example.total) })}
              </p>
              <p className="num text-sm font-bold">
                {tf("partnerExampleSessions", lang, {
                  first: fmt(example.first),
                  repeat: fmt(example.repeat),
                })}
              </p>
              <p className="num text-sm font-bold text-primary-strong">
                {tf("partnerExampleBreak", lang, { n: fmt(example.total) })}
              </p>
              <p className="text-xs leading-relaxed text-muted">
                {t("partnerExampleNote", lang)}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-extrabold">
                {t("partnerMeterTitle", lang)}
              </h3>
              <ul className="flex flex-col gap-3">
                {meter.rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-bold">
                        {t(
                          r.id === "first"
                            ? "partnerMeterFirst"
                            : r.id === "next"
                              ? "partnerMeterNext"
                              : "partnerMeterSkin",
                          lang,
                        )}
                      </span>
                      <span className="num font-extrabold text-primary-strong">
                        {tf("partnerUnits", lang, { n: r.units })}
                      </span>
                    </div>
                    <div
                      className="h-3 rounded-full bg-panel-2"
                      role="img"
                      aria-label={tf("partnerUnits", lang, { n: r.units })}
                    >
                      <div
                        className="h-3 rounded-full bg-primary"
                        style={{ width: `${(r.units / maxUnits) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                {tf("partnerMeterCap", lang, { n: meter.cap })}
              </p>
            </div>
            <div className="flex flex-col gap-3" data-testid="cost-calc">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-bold">
                  {t("partnerCalcFirst", lang)}
                  <input
                    value={first}
                    onChange={(e) =>
                      setFirst(e.target.value.replace(/\D/g, "").slice(0, 7))
                    }
                    inputMode="numeric"
                    className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold">
                  {t("partnerCalcRepeat", lang)}
                  <input
                    value={repeat}
                    onChange={(e) =>
                      setRepeat(e.target.value.replace(/\D/g, "").slice(0, 7))
                    }
                    inputMode="numeric"
                    className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium"
                  />
                </label>
              </div>
              <p
                className="num text-lg font-extrabold text-primary-strong"
                aria-live="polite"
              >
                {tf("partnerCalcTotal", lang, {
                  n: estimate.total.toLocaleString(
                    lang === "ko" ? "ko-KR" : "en-US",
                  ),
                })}
              </p>
              <p className="text-xs text-muted">
                {t("partnerCalcNote", lang)} {t("partnerCalcSkinNote", lang)}
              </p>
              <div
                className="flex flex-col gap-3 border-t border-line pt-3"
                data-testid="break-even"
              >
                <h3 className="text-sm font-extrabold">
                  {t("partnerBreakTitle", lang)}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-bold">
                    {t("partnerBreakPrice", lang)}
                    <input
                      value={price}
                      onChange={(e) =>
                        setPrice(
                          e.target.value.replace(/[^\d.]/g, "").slice(0, 8),
                        )
                      }
                      inputMode="decimal"
                      className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-bold">
                    {t("partnerBreakMargin", lang)}
                    <input
                      value={margin}
                      onChange={(e) =>
                        setMargin(
                          e.target.value.replace(/[^\d.]/g, "").slice(0, 8),
                        )
                      }
                      inputMode="decimal"
                      className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium"
                    />
                  </label>
                </div>
                <p className="num text-sm font-bold" aria-live="polite">
                  {tf("partnerBreakCost", lang, {
                    cost: be.cost.toLocaleString(
                      lang === "ko" ? "ko-KR" : "en-US",
                    ),
                  })}
                  {be.orders !== null && (
                    <span className="block text-primary-strong">
                      {tf("partnerBreakOrders", lang, {
                        n: be.orders.toLocaleString(
                          lang === "ko" ? "ko-KR" : "en-US",
                        ),
                      })}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {t("partnerBreakNote", lang)}
                </p>
              </div>
            </div>
          </div>
        </details>
        <details
          id="two-week-test"
          className="group scroll-mt-20 min-w-0 rounded-[var(--radius-panel)] bg-panel lg:col-span-2"
          data-testid="retailer-test"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-col">
              <span className="text-[17px] font-extrabold">
                {t("partnerTestTitle", lang)}
              </span>
              <span className="text-xs font-medium text-muted">
                {t("partnerTestTag", lang)}
              </span>
            </span>
            <Icon
              name="back"
              className="h-4 w-4 flex-none -rotate-90 text-muted transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <span className="inline-flex">
              <Chip tone="warn">{t("partnerTestTag", lang)}</Chip>
            </span>
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
              <li>{t("partnerTestDesign", lang)}</li>
              <li className="font-bold">{t("partnerTestPrimary", lang)}</li>
              <li>{t("partnerTestSecondary", lang)}</li>
              <li className="num">
                {tf("partnerTestSize", lang, {
                  p: String(TEST_BASELINE * 100),
                  d: String(TEST_LIFT * 100),
                  n: fmt(testPerArm),
                })}
              </li>
              <li className="font-bold text-primary-strong">
                {tf("partnerTestRule", lang, { d: String(TEST_LIFT * 100) })}
              </li>
              <li className="num">
                {tf("partnerTestCost", lang, {
                  n: fmt(testPerArm),
                  u: fmt(testUnitCeiling(testPerArm)),
                })}
              </li>
            </ul>
            <p className="text-xs leading-relaxed text-muted">
              {t("partnerTestNote", lang)}
            </p>
          </div>
        </details>
        <details
          id="embed-snippet"
          className="group scroll-mt-20 min-w-0 rounded-[var(--radius-panel)] bg-panel lg:col-span-2"
          data-testid="partner-snippet"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-col">
              <span className="text-[17px] font-extrabold">
                {t("partnerSnippetTitle", lang)}
              </span>
              <span className="text-xs font-medium text-muted">
                {t("partnerSnippetSub", lang)}
              </span>
            </span>
            <Icon
              name="back"
              className="h-4 w-4 flex-none -rotate-90 text-muted transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-canvas">
              <code>{integrationSnippet(shade)}</code>
            </pre>
            <p className="text-xs text-muted">
              {t("partnerSnippetNote", lang)}
            </p>
          </div>
        </details>
        <details
          id="kpis"
          className="group scroll-mt-20 min-w-0 rounded-[var(--radius-panel)] bg-panel lg:col-span-2"
          data-testid="partner-kpis"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-col">
              <span className="text-[17px] font-extrabold">
                {t("partnerKpiTitle", lang)}
              </span>
              <span className="text-xs font-medium text-muted">
                {t("partnerKpiHypothesis", lang)}
              </span>
            </span>
            <Icon
              name="back"
              className="h-4 w-4 flex-none -rotate-90 text-muted transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PARTNER_KPIS.map((key) => (
                <li
                  key={key}
                  className="flex flex-col gap-1 rounded-xl bg-canvas p-3"
                >
                  <span className="text-sm font-extrabold">{t(key, lang)}</span>
                  <span className="text-xs text-muted">
                    {t(`${key}Body` as "partnerKpi1Body", lang)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t("partnerKpiNote", lang)}</p>
          </div>
        </details>

        <ButtonLink href="/" variant="ghost" className="w-full lg:col-span-2">
          {t("back", lang)}
        </ButtonLink>
      </main>
    </Screen>
  );
}
