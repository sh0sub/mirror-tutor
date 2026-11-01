"use client";

import { useMemo, useState } from "react";
import { AppBar, BottomBar, ButtonLink, Chip, Icon, Screen } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import type { Lang } from "@/lib/rules/engine";
import { EYELIDS, LIP_SHAPES, type Eyelid, type LipShape } from "@/lib/profile";
import { buildLesson } from "@/lib/lessons";
import { ATTR_NAME, FACE_NAME, sourceCaption, valueLabel } from "@/lib/labels";
import { comparePair, compareStep, eyelidStep, sameEyelid, type CompareManifest, type CompareModel, type TechniqueRow } from "@/lib/demo/compare";
import manifestJson from "@/public/demo/compare.json";

const manifest = manifestJson as CompareManifest;
const faceName = (m: CompareModel, lang: Lang) => FACE_NAME[m.profile.eyelid][lang];

function RuleList({ rows, lang, names }: { rows: TechniqueRow[]; lang: Lang; names: [string, string] }) {
  return (
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
                          {names[i]} · {r.values[i]}
                        </span>
                        <span className="font-bold leading-snug">{r.techniques[i]}</span>
                        <span className="num text-xs text-muted">{r.patterns[i]}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
  );
}

/** Pair shown on /compare (monolid face vs double-lid face) and the step whose eye technique differs. */
const pair = comparePair(manifest);
const eyeStep = eyelidStep(manifest.lessonId, pair[0].profile, pair[1].profile);

/** S2 "두 얼굴 비교": monolid face vs double-lid face, same lesson, side by side + the rule-table branch each took. 0 live units. */
export default function ComparePage() {
  const { lang } = useFlow();
  const [a, b] = pair;
  // Open on the eye step: that's where the monolid and double-lid techniques split.
  const [k, setK] = useState(eyeStep ?? 4);
  const [before, setBefore] = useState(false);
  // What-if: the rule table's other branches (inner double, hooded, lip shapes) on the double-lid face. Text only, 0 units.
  const wiEyelids = EYELIDS.filter((e) => e !== b.profile.eyelid && e !== a.profile.eyelid);
  const [wiEyelid, setWiEyelid] = useState<Eyelid>(wiEyelids.includes("hooded") ? "hooded" : (wiEyelids[0] ?? b.profile.eyelid));
  const [wiLip, setWiLip] = useState<LipShape>("thin");
  const wiProfile = useMemo(() => ({ ...b.profile, eyelid: wiEyelid, lipShape: wiLip }), [b.profile, wiEyelid, wiLip]);
  const wiRows = useMemo(() => compareStep(manifest.lessonId, b.profile, wiProfile, k, lang), [b.profile, wiProfile, k, lang]);
  const plan = useMemo(() => buildLesson(manifest.lessonId, a.profile), [a.profile]);
  const rows = useMemo(() => compareStep(manifest.lessonId, a.profile, b.profile, k, lang), [a.profile, b.profile, k, lang]);
  const step = plan.steps[k - 1];
  const edited = pair.find((m) => m.edited?.includes("eyelid"));

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
              {s.index === eyeStep && <span className="sr-only"> · {t("compareEyeStep", lang)}</span>}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2" role="tabpanel" aria-label={`${tf("stepNumbered", lang, { n: k })} ${step.title[lang]}`}>
          {pair.map((m) => (
            <figure key={m.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-panel-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- static pre-generated demo asset */}
                <img
                  src={before ? m.original : m.steps[k - 1]}
                  alt={`${faceName(m, lang)} · ${before ? t("original", lang) : `${t("answer", lang)} · ${tf("answerCumulative", lang, { n: k })}`}`}
                  className="h-full w-full object-cover"
                  width={600}
                  height={800}
                />
                <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-canvas">{before ? t("original", lang) : t("answer", lang)}</span>
              </div>
              <figcaption className="flex flex-col items-start gap-1">
                <span className="text-base font-extrabold">{faceName(m, lang)}</span>
                <div className="flex flex-wrap gap-1">
                  <Chip tone="accent">{valueLabel("eyelid", m.profile.eyelid, lang)}</Chip>
                  {m.edited?.includes("eyelid") && <Chip tone="warn">{tf("compareEditedChip", lang, { raw: sourceCaption(m.source.eyelid) })}</Chip>}
                </div>
                <span className="num text-xs text-muted">
                  {m.edited?.includes("eyelid") ? tf("compareEdited", lang, { raw: sourceCaption(m.source.eyelid) }) : sourceCaption(m.source.eyelid)}
                </span>
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
            <RuleList rows={rows} lang={lang} names={[faceName(a, lang), faceName(b, lang)]} />
          )}
          {edited && rows.some((r) => r.attr === "eyelid") && <p className="text-xs text-muted">{t("compareEditedNote", lang)}</p>}
          {b.profile.eyelid === "inner_double" && rows.some((r) => r.attr === "eyelid") && <p className="text-xs text-muted">{t("compareInnerNote", lang)}</p>}
        </section>

        <section aria-labelledby="whatif" className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-peach bg-panel p-4">
          <h2 id="whatif" className="text-sm font-extrabold">
            {t("whatIfTitle", lang)}
          </h2>
          <p className="text-xs text-muted">{t("whatIfBody", lang)}</p>
          {(
            [
              { key: "eyelid", options: wiEyelids, value: wiEyelid, set: setWiEyelid as (v: string) => void },
              { key: "lipShape", options: LIP_SHAPES, value: wiLip, set: setWiLip as (v: string) => void },
            ] as const
          ).map((g) => (
            <div key={g.key} role="group" aria-label={ATTR_NAME[g.key][lang]} className="flex flex-wrap gap-1.5">
              {g.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={g.value === o}
                  onClick={() => g.set(o)}
                  className={`min-h-10 rounded-full px-3 text-xs font-bold ${g.value === o ? "bg-primary text-on-primary" : "bg-panel-2 text-muted"}`}
                >
                  {valueLabel(g.key, o as never, lang)}
                </button>
              ))}
            </div>
          ))}
          {wiRows.length === 0 ? <p className="text-sm text-muted">—</p> : <RuleList rows={wiRows} lang={lang} names={[faceName(b, lang), t("whatIfName", lang)]} />}
        </section>

        <section aria-labelledby="samples" className="flex flex-col gap-2">
          <h2 id="samples" className="text-sm font-extrabold">
            {t("sampleTitle", lang)}
          </h2>
          <p className="text-xs text-muted">{t("sampleBody", lang)}</p>
          <div className="grid grid-cols-1 gap-2">
            {manifest.models.map((m) => (
              <a
                key={m.id}
                href={m.original}
                download={`mirror-tutor-sample-${m.profile.eyelid.replace("_", "-")}.jpg`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] border border-line-strong/50 bg-panel px-3 text-sm font-bold hover:bg-panel-2"
              >
                <Icon name="download" className="h-4 w-4" />
                {tf("downloadSample", lang, { name: faceName(m, lang) })}
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
