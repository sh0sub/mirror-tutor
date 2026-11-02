"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompareSlider } from "@/components/CompareSlider";
import { ProductArt } from "@/components/ProductArt";
import { Swatch } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson } from "@/lib/lessons";
import { comparePair, type CompareManifest } from "@/lib/demo/compare";
import { EMBED_LESSON, embedFocusStep, embedMatch, embedProductFromQuery } from "@/lib/embed";
import manifestJson from "@/public/demo/compare.json";

const model = comparePair(manifestJson as CompareManifest)[0];

/** Chrome-less lesson widget for a retailer's product page: stepper, bare/finished slider, CIEDE2000-matched product. No app bar, no flow state, 0 units. */
function EmbedInner() {
  const { lang } = useFlow();
  const params = useSearchParams();
  const product = embedProductFromQuery({ sku: params.get("sku"), hex: params.get("hex"), name: params.get("name") });
  const plan = useMemo(() => buildLesson(EMBED_LESSON, model.profile), []);
  const [k, setK] = useState(() => embedFocusStep(model.profile, product));
  const step = plan.steps[k - 1];
  const match = embedMatch(step, product);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-3 bg-canvas p-3" data-testid="embed-widget">
      <div className="overflow-hidden rounded-xl">
        <CompareSlider
          key={k}
          before={model.original}
          after={model.steps[k - 1]}
          label={t("sliderLabel", lang)}
          beforeLabel={t("heroBare", lang)}
          afterLabel={tf("answerCumulative", lang, { n: k })}
          aspect="aspect-[7/8]"
        />
      </div>
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
      <p className="text-sm leading-snug">{step.instruction[lang]}</p>
      {match && (
        <section aria-label={t("embedMatchTitle", lang)} className="flex items-center gap-3 rounded-xl bg-panel p-3" data-testid="embed-match">
          <ProductArt category={match.product.category} shades={match.product.shades} texture={match.product.texture} className="h-16 w-16 flex-none" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xs font-bold text-muted">{match.featured ? t("embedFeatured", lang) : t("embedClosest", lang)}</p>
            <p className="text-sm font-extrabold leading-snug">{match.product.name[lang]}</p>
            <p className="num flex items-center gap-2 text-xs text-muted">
              <Swatch hex={match.hex} /> {tf("embedDelta", lang, { n: match.deltaE })} · {t(match.close ? "embedClose" : "embedFar", lang)}
            </p>
          </div>
        </section>
      )}
      <p className="mt-auto text-center text-[11px] leading-snug text-muted">
        {t("embedFoot", lang)}{" "}
        <a href={`/?lang=${lang}`} target="_blank" rel="noopener" className="font-bold text-primary-strong underline underline-offset-2">
          {t("embedOpen", lang)}
        </a>
      </p>
    </main>
  );
}

export default function EmbedLessonPage() {
  return (
    <Suspense fallback={null}>
      <EmbedInner />
    </Suspense>
  );
}
