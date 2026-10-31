"use client";

import { useMemo, useState } from "react";
import { AppBar, BottomBar, ButtonLink, Chip, Icon, Screen } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson } from "@/lib/lessons";
import { ATTR_NAME, sourceCaption, valueLabel } from "@/lib/labels";
import { compareStep, sameEyelid, type CompareManifest } from "@/lib/demo/compare";
import manifestJson from "@/public/demo/compare.json";

const manifest = manifestJson as CompareManifest;
const letter = (i: number) => String.fromCharCode(65 + i);

/** S2 "두 얼굴 비교": two pre-generated models, same lesson, side by side + the rule-table branch each took. 0 live units. */
export default function ComparePage() {
  const { lang } = useFlow();
  const [k, setK] = useState(4);
  const [before, setBefore] = useState(false);
  const [a, b] = manifest.models;
  const plan = useMemo(() => buildLesson(manifest.lessonId, a.profile), [a.profile]);
  const rows = useMemo(() => compareStep(manifest.lessonId, a.profile, b.profile, k, lang), [a.profile, b.profile, k, lang]);
  const step = plan.steps[k - 1];

  return (
    <Screen>
      <AppBar title={t("compareTitle", lang)} backHref="/" />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div>
          <p className="text-lg font-extrabold">{plan.title[lang]}</p>
          <p className="text-sm text-muted">{t("compareIntro", lang)}</p>
        </div>

        <div role="tablist" aria-label={t("stepsNav", lang)} className="grid grid-cols-4 gap-1.5">
          {plan.steps.map((s) => (
            <button
              key={s.index}
              type="button"
              role="tab"
              aria-selected={s.index === k}
              onClick={() => setK(s.index)}
              className={`min-h-12 rounded-[var(--radius-button)] px-1 text-xs font-bold ${s.index === k ? "bg-peach-soft text-primary-strong ring-2 ring-primary" : "bg-panel-2 text-muted"}`}
            >
              <span className="num block text-sm">{s.index}</span>
              {s.title[lang]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2" role="tabpanel" aria-label={`${tf("stepNumbered", lang, { n: k })} ${step.title[lang]}`}>
          {manifest.models.map((m, i) => (
            <figure key={m.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-panel-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- static pre-generated demo asset */}
                <img
                  src={before ? m.original : m.steps[k - 1]}
                  alt={`${tf("modelN", lang, { n: letter(i) })} · ${before ? t("original", lang) : `${t("answer", lang)} · ${tf("answerCumulative", lang, { n: k })}`}`}
                  className="h-full w-full object-cover"
                  width={600}
                  height={800}
                />
                <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-canvas">{before ? t("original", lang) : t("answer", lang)}</span>
              </div>
              <figcaption className="flex flex-col items-start gap-1">
                <span className="text-sm font-extrabold">{tf("modelN", lang, { n: letter(i) })}</span>
                <Chip tone="accent">{valueLabel("eyelid", m.profile.eyelid, lang)}</Chip>
                <span className="num text-xs text-muted">{sourceCaption(m.source.eyelid)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setBefore((v) => !v)}
          aria-pressed={before}
          className="min-h-12 self-center rounded-[var(--radius-button)] border border-line-strong/50 bg-panel px-5 text-sm font-bold hover:bg-panel-2"
        >
          {before ? t("showAfter", lang) : t("showBefore", lang)}
        </button>

        <section aria-labelledby="rules" className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-panel p-4">
          <h2 id="rules" className="text-sm font-extrabold">
            {t("compareRules", lang)}
          </h2>
          {sameEyelid(manifest) && <p className="text-xs text-warning">{t("compareSameEyelid", lang)}</p>}
          {rows.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.attr} className="flex flex-col gap-1.5 border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{ATTR_NAME[r.attr][lang]}</span>
                    <Chip tone={r.same ? "neutral" : "accent"} icon={r.same ? "check" : "sparkle"}>
                      {r.same ? t("same", lang) : t("different", lang)}
                    </Chip>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted">
                          {tf("modelN", lang, { n: letter(i) })} · {r.values[i]}
                        </span>
                        <span className="font-bold leading-snug">{r.techniques[i]}</span>
                        <span className="num text-xs text-muted">{r.patterns[i]}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {b.profile.eyelid === "inner_double" && rows.some((r) => r.attr === "eyelid") && <p className="text-xs text-muted">{t("compareInnerNote", lang)}</p>}
        </section>

        <section aria-labelledby="samples" className="flex flex-col gap-2">
          <h2 id="samples" className="text-sm font-extrabold">
            {t("sampleTitle", lang)}
          </h2>
          <p className="text-xs text-muted">{t("sampleBody", lang)}</p>
          <div className="grid grid-cols-2 gap-2">
            {manifest.models.map((m, i) => (
              <a
                key={m.id}
                href={m.original}
                download={`mirror-tutor-sample-${letter(i).toLowerCase()}.jpg`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] border border-line-strong/50 bg-panel px-3 text-sm font-bold hover:bg-panel-2"
              >
                <Icon name="download" className="h-4 w-4" />
                {tf("downloadSample", lang, { name: tf("modelN", lang, { n: letter(i) }) })}
              </a>
            ))}
          </div>
        </section>
        <p className="text-xs leading-relaxed text-muted">{tf("compareCredit", lang, { date: manifest.generatedAt })}</p>
      </main>
      <BottomBar>
        <ButtonLink href="/" className="w-full">
          {t("tryMyFace", lang)}
        </ButtonLink>
      </BottomBar>
    </Screen>
  );
}
