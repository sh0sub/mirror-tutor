"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar, Button, ButtonLink, Chip, Icon, Screen, Swatch } from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { PRODUCTS } from "@/lib/shop";
import { PARTNER_KPIS, PARTNER_SHADES, PARTNER_SKU, embedQuery, integrationSnippet, unitEstimate, unitMeter } from "@/lib/partner";
import { EMBED_NAME_MAX, customProduct, parseCustomShade } from "@/lib/embed";

const demoProduct = PRODUCTS.find((p) => p.sku === PARTNER_SKU)!;
const meter = unitMeter();

/** Concept screen for the buyer (a beauty retailer): the lesson widget on a fictional product page, the integration line, the unit cost and the KPIs to measure. */
export default function PartnerPage() {
  const { lang, startSample } = useFlow();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hexInput, setHexInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [first, setFirst] = useState("1000");
  const [repeat, setRepeat] = useState("500");
  const shade = parseCustomShade(hexInput, nameInput);
  const hexBad = hexInput.trim() !== "" && !shade;
  const product = shade ? customProduct(shade) : demoProduct;
  const estimate = unitEstimate(Number(first), Number(repeat));
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
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
          <Chip tone="warn" icon="info" wrap>
            {t("partnerConcept", lang)}
          </Chip>
          <p className="max-w-[720px] text-[15px] leading-relaxed text-muted">{t("partnerIntro", lang)}</p>
        </div>

        {/* fictional product page with the embedded widget */}
        <section aria-label="MT Select" className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-panel p-4">
          <div className="flex items-center gap-4">
            <ProductArt category={product.category} shades={product.shades} texture={product.texture} className="h-24 w-24 flex-none" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs font-bold text-muted">MT Select</p>
              <h2 className="text-[17px] font-extrabold leading-snug">{product.name[lang].replace(/^MT Select\s*/, "")}</h2>
              {!shade && <p className="num text-sm font-bold">{lang === "ko" ? `${product.priceKrw.toLocaleString("ko-KR")}원` : `$${product.priceUsd}`}</p>}
              {shade && <p className="num text-sm font-bold text-muted">{shade.hex}</p>}
            </div>
          </div>
          <Button variant="ghost" className="w-full" disabled>
            <Icon name="bag" className="h-4 w-4" />
            {t("partnerAddToCart", lang)}
          </Button>

          <div data-testid="partner-widget" className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-canvas p-2">
            <p className="flex items-center gap-2 px-1 pt-1 text-sm font-extrabold text-primary-strong">
              <Icon name="sparkle" className="h-4 w-4" />
              {t("partnerWidgetTitle", lang)}
            </p>
            <iframe src={`/embed/lesson?${embedQuery(shade)}&lang=${lang}`} title={t("partnerWidgetTitle", lang)} className="mx-auto h-[640px] w-full max-w-[360px] rounded-xl border-0" loading="lazy" />
            <Button className="w-full" onClick={trySample} disabled={busy}>
              {t("partnerWidgetCta", lang)}
            </Button>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="try-shade" className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4" data-testid="try-shade">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="try-shade" className="text-[17px] font-extrabold">
                {t("partnerTryTitle", lang)}
              </h2>
              <Chip tone="warn">{t("partnerTryChip", lang)}</Chip>
            </div>
            <p className="text-xs text-muted">{t("partnerTryNote", lang)}</p>
            <div role="group" aria-label={t("partnerTryPalette", lang)} className="flex flex-wrap gap-1.5">
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
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={EMBED_NAME_MAX} className="min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium" />
              </label>
            </div>
            {hexBad && (
              <p id="hex-bad" role="alert" className="text-xs font-bold text-danger">
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

          <section aria-labelledby="snippet" className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-panel)] bg-panel p-4">
            <h2 id="snippet" className="text-[17px] font-extrabold">
              {t("partnerSnippetTitle", lang)}
            </h2>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-canvas">
              <code>{integrationSnippet(shade)}</code>
            </pre>
            <p className="text-xs text-muted">{t("partnerSnippetNote", lang)}</p>
          </section>

          <section aria-labelledby="meter" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4">
            <h2 id="meter" className="text-[17px] font-extrabold">
              {t("partnerMeterTitle", lang)}
            </h2>
            <ul className="flex flex-col gap-3">
              {meter.rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-bold">{t(r.id === "first" ? "partnerMeterFirst" : "partnerMeterNext", lang)}</span>
                    <span className="num font-extrabold text-primary-strong">{tf("partnerUnits", lang, { n: r.units })}</span>
                  </div>
                  <div className="h-3 rounded-full bg-panel-2" role="img" aria-label={tf("partnerUnits", lang, { n: r.units })}>
                    <div className="h-3 rounded-full bg-primary" style={{ width: `${(r.units / maxUnits) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{tf("partnerMeterCap", lang, { n: meter.cap })}</p>
          </section>

          <section aria-labelledby="calc" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4" data-testid="cost-calc">
            <h2 id="calc" className="text-[17px] font-extrabold">
              {t("partnerCalcTitle", lang)}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t("partnerCalcFirst", lang)}
                <input value={first} onChange={(e) => setFirst(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t("partnerCalcRepeat", lang)}
                <input value={repeat} onChange={(e) => setRepeat(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" className="num min-h-12 rounded-xl border border-line bg-canvas px-3 text-[15px] font-medium" />
              </label>
            </div>
            <p className="num text-lg font-extrabold text-primary-strong" aria-live="polite">
              {tf("partnerCalcTotal", lang, { n: estimate.total.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") })}
            </p>
            <p className="text-xs text-muted">{t("partnerCalcNote", lang)}</p>
          </section>

          <section aria-labelledby="kpi" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="kpi" className="text-[17px] font-extrabold">
                {t("partnerKpiTitle", lang)}
              </h2>
              <Chip tone="warn">{t("partnerKpiHypothesis", lang)}</Chip>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {PARTNER_KPIS.map((key) => (
                <li key={key} className="flex flex-col gap-1 rounded-xl bg-canvas p-3">
                  <span className="text-sm font-extrabold">{t(key, lang)}</span>
                  <span className="text-xs text-muted">{t(`${key}Body` as "partnerKpi1Body", lang)}</span>
                  <span className="num text-sm font-bold text-muted">— · {t("partnerKpiNoData", lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <ButtonLink href="/" variant="ghost" className="w-full lg:col-span-2">
          {t("back", lang)}
        </ButtonLink>
      </main>
    </Screen>
  );
}
