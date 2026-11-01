"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar, Button, ButtonLink, Chip, Icon, Screen } from "@/components/ui";
import { ProductArt } from "@/components/ProductArt";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson } from "@/lib/lessons";
import { PRODUCTS } from "@/lib/shop";
import { INTEGRATION_SNIPPET, PARTNER_KPIS, PARTNER_SKU, unitMeter } from "@/lib/partner";
import { comparePair, type CompareManifest } from "@/lib/demo/compare";
import manifestJson from "@/public/demo/compare.json";

/** The monolid face (analyzer reading corrected in the edit sheet) and its pre-generated lesson steps. */
const model = comparePair(manifestJson as CompareManifest)[0];
const product = PRODUCTS.find((p) => p.sku === PARTNER_SKU)!;
const meter = unitMeter();

/** Concept screen for the buyer (a beauty retailer): the lesson widget on a fictional product page, the integration line, the unit cost and the KPIs to measure. */
export default function PartnerPage() {
  const { lang, startSample } = useFlow();
  const router = useRouter();
  const [k, setK] = useState(4);
  const [busy, setBusy] = useState(false);
  const plan = buildLesson("daily-k", model.profile);
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
              <p className="num text-sm font-bold">{lang === "ko" ? `${product.priceKrw.toLocaleString("ko-KR")}원` : `$${product.priceUsd}`}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full" disabled>
            <Icon name="bag" className="h-4 w-4" />
            {t("partnerAddToCart", lang)}
          </Button>

          <div data-testid="partner-widget" className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-canvas p-3">
            <p className="flex items-center gap-2 text-sm font-extrabold text-primary-strong">
              <Icon name="sparkle" className="h-4 w-4" />
              {t("partnerWidgetTitle", lang)}
            </p>
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-xl bg-panel-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- static pre-generated demo asset */}
              <img src={model.steps[k - 1]} alt="" width={600} height={800} className="h-full w-full object-cover" />
            </div>
            <p className="text-center text-xs text-muted">{tf("partnerWidgetCaption", lang, { n: k })}</p>
            <div className="grid grid-cols-4 gap-1" role="group" aria-label={t("stepsNav", lang)}>
              {plan.steps.map((s) => (
                <button
                  key={s.index}
                  type="button"
                  aria-pressed={k === s.index}
                  onClick={() => setK(s.index)}
                  className={`min-h-12 rounded-xl px-1 text-xs font-bold ${k === s.index ? "bg-primary text-on-primary" : "bg-panel text-ink"}`}
                >
                  {s.index} · {s.title[lang]}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={trySample} disabled={busy}>
              {t("partnerWidgetCta", lang)}
            </Button>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="snippet" className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-panel)] bg-panel p-4">
            <h2 id="snippet" className="text-[17px] font-extrabold">
              {t("partnerSnippetTitle", lang)}
            </h2>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-canvas">
              <code>{INTEGRATION_SNIPPET}</code>
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
