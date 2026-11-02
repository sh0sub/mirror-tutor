"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar, BottomBar, Button, ButtonLink, Chip, Icon, ModeBanner, Screen, Sheet, Swatch, UnitLine } from "@/components/ui";
import { EyeOverlaySvg } from "@/components/EyeOverlaySvg";
import { CompareSlider } from "@/components/CompareSlider";
import { useFlow, type StepState } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson, getLesson, INTENSITY_SCALES, type StepScales } from "@/lib/lessons";
import { ATTR_NAME, valueLabel } from "@/lib/labels";
import { PROFILE_OPTIONS } from "@/lib/profile";
import { monoSampleNeedsFix } from "@/lib/demo/sample";
import { techniqueDir } from "@/lib/eyeOverlay";
import { guideText } from "@/lib/quality/messages";
import { regionBoxes } from "@/lib/regions";
import { stepDotKind, type StepDotKind } from "@/lib/stepper";

/** The 3:4 photo is object-cover in the box, so only this fraction of its height is visible (box 4:5 → 0.9375, 7:8 → 0.857). */
const VISIBLE_45 = 0.75 / 0.8;
const VISIBLE_78 = 0.75 / 0.875;

/** Dashed oval around the step's region, mapped from photo coordinates to the cropped box. */
function RegionOverlay({ boxes, visible, className }: { boxes: ReturnType<typeof regionBoxes>; visible: number; className: string }) {
  const top = ((1 - visible) / 2) * 100;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden>
      {boxes.map((b, i) => (
        <ellipse key={i} cx={(b.x + b.w / 2) * 100} cy={((b.y + b.h / 2) * 100 - top) / visible} rx={(b.w / 2) * 100 + 2} ry={(b.h / 2 / visible) * 100 + 2} fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="1.5 1.2" />
      ))}
    </svg>
  );
}

function dotClass(s: StepState | undefined, kind: StepDotKind) {
  if (kind === "active") return "bg-primary text-on-primary";
  if (s?.status === "error" || s?.status === "blocked") return "bg-danger-soft text-danger";
  if (kind === "done") return "bg-success text-white";
  return "border-2 border-dashed border-line-strong/60 text-muted";
}

/** M3 lesson player: skeleton → sequential reveal, before/after slider, step card with "왜 당신은" reasons and hex swatches. */
function LessonInner() {
  const { lang, photo, anchors, eyeOverlay, skin, stored, renders, render, mode, scales, setStepScale, sample, sampleId, loadSampleAttempt, editProfile } = useFlow();
  const [attemptBusy, setAttemptBusy] = useState(false);
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "daily-k";
  const lesson = getLesson(id);
  const [k, setK] = useState(1);
  const [whyOpen, setWhyOpen] = useState(true);
  const [technique, setTechnique] = useState(true);
  const [fixOpen, setFixOpen] = useState(false);
  const started = useRef<string | null>(null);

  const lessonScales = scales[id];
  // same options as /api/render so the swatches match the answer (demo mode keeps the default base color)
  const skinShade = mode === "demo" ? null : (skin?.shadeId ?? null);
  const plan = useMemo(
    () => (stored && lesson ? buildLesson(lesson.id, stored.profile, { stepScales: lessonScales as StepScales | undefined, skinShade }) : null),
    [stored, lesson, lessonScales, skinShade],
  );
  const steps = renders[id] ?? {};

  useEffect(() => {
    if (!photo || !stored) {
      router.replace(stored ? `/capture?lesson=${id}` : "/capture");
      return;
    }
    if (started.current === id || renders[id]) return;
    started.current = id;
    void render(id);
  }, [photo, stored, id, renders, render, router]);

  // A6: on the eye step the nudge sits under the photo, behind the fixed bottom bar on a phone → bring it fully into view (once per step visit).
  const nudgeRef = useRef<HTMLDivElement>(null);
  const nudgeActive = !!plan && !!photo && plan.steps[k - 1]?.region === "eye_lid" && monoSampleNeedsFix(sample, sampleId, stored);
  useEffect(() => {
    if (!nudgeActive) return;
    const id = window.setTimeout(() => nudgeRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 350);
    return () => window.clearTimeout(id);
  }, [nudgeActive, k]);

  if (!plan || !lesson || !photo) return <Screen>{null}</Screen>;
  const step = plan.steps[k - 1];
  const state = steps[k];
  const before = mode === "demo" ? "/demo/sample-model.svg" : photo.url;
  const after = state?.status === "done" ? state.image : null;
  const last = k === plan.steps.length;
  const finalState = steps[plan.steps.length];
  const answerImage = finalState?.status === "done" ? finalState.image : null;
  // demo mode shows the sample model (canonical position); otherwise fit the boxes to this photo's face
  // C18: on the eye step, draw the lid area / crease / gradient direction from this photo's landmarks
  const eyeStep = step.region === "eye_lid" && mode !== "demo" && eyeOverlay !== null;
  const eyelid = stored?.profile.eyelid ?? "double";
  // A1: a visitor who skipped the correction on /analyze would get the double-lid technique here, so nudge on the eye step
  const showFixNudge = step.region === "eye_lid" && monoSampleNeedsFix(sample, sampleId, stored);
  const boxes = regionBoxes(step.region, mode === "demo" ? null : anchors);

  return (
    <Screen wide>
      <AppBar
        title={lesson.title[lang]}
        backHref="/analyze"
        right={
          <span className="num text-sm font-bold text-muted">
            {k}/{plan.steps.length}
          </span>
        }
      />
      <ModeBanner />
      <main className="flex flex-1 flex-col pb-8 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-8 lg:px-6 lg:pt-4">
        <div className="lg:col-start-1 lg:row-start-1">
        <CompareSlider
          before={before}
          after={after}
          label={t("sliderLabel", lang)}
          beforeLabel={t(sample ? "sampleFace" : "myFace", lang)}
          afterLabel={`${t("answer", lang)} · ${tf("answerCumulative", lang, { n: k })}`}
          // 390x844 phones get a 7:8 box (about 40 px shorter than 4:5) so the step instruction stays above the fold; desktop keeps 4:5.
          aspect="aspect-[7/8] max-lg:max-h-[42dvh] lg:aspect-[4/5]"
          overlay={
            <>
              {eyeStep && technique && eyeOverlay ? (
                [
                  { visible: VISIBLE_78, className: "lg:hidden" },
                  { visible: VISIBLE_45, className: "max-lg:hidden" },
                ].map((o) => (
                  <EyeOverlaySvg key={o.className} overlay={eyeOverlay} dir={techniqueDir(eyelid)} crease={eyelid !== "monolid"} view={{ x: 0, y: (1 - o.visible) / 2, w: 1, h: o.visible }} head={22} className={o.className} />
                ))
              ) : (
                <>
                  <RegionOverlay boxes={boxes} visible={VISIBLE_78} className="lg:hidden" />
                  <RegionOverlay boxes={boxes} visible={VISIBLE_45} className="max-lg:hidden" />
                </>
              )}
            </>
          }
        />

        {showFixNudge && (
          <p data-testid="lesson-uncorrected-line" className="mx-4 mt-2 hidden items-start lg:flex gap-1.5 text-xs font-bold leading-snug text-warning lg:mx-0">
            <Icon name="warn" className="mt-px h-3.5 w-3.5 flex-none" />
            {t("lessonUncorrectedLine", lang)}
          </p>
        )}

        <nav aria-label={t("stepsNav", lang)} className="flex items-center justify-between gap-1 px-4 py-3">
          {plan.steps.map((s) => {
            const st = steps[s.index];
            const kind = stepDotKind(s.index, k);
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => setK(s.index)}
                aria-current={s.index === k ? "step" : undefined}
                className="flex min-h-12 flex-1 flex-col items-center gap-1 text-xs font-bold"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${dotClass(st, kind)}`}>
                  {st?.status === "error" && kind !== "active" ? <Icon name="warn" className="h-4 w-4" /> : kind === "done" ? <Icon name="check" className="h-4 w-4" /> : s.index}
                </span>
                <span className={s.index === k ? "text-ink" : "text-muted"}>
                  {s.title[lang]}
                  {st?.status === "pending" && s.index !== k ? ` · ${t("stepRendering", lang)}` : ""}
                </span>
              </button>
            );
          })}
        </nav>
        </div>

        <section className="mx-4 mb-4 flex flex-col gap-3 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:mb-0 rounded-[var(--radius-panel)] bg-panel p-4" aria-live="polite">
          {(!state || state.status === "pending") && (
            <p className="flex items-center gap-2 text-sm font-bold text-muted" role="status">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              {tf("stepNumbered", lang, { n: k })} · {t("stepWaiting", lang)}
            </p>
          )}
          {state?.status === "error" && (
            <div role="alert" className="flex flex-col gap-2">
              <Chip tone="bad">{t("stepFailed", lang)}</Chip>
              <p className="text-sm">{guideText(state.guide, lang)}</p>
              <Button variant="ghost" onClick={() => render(id, [k])}>
                {t("retryStep", lang)}
              </Button>
            </div>
          )}
          {state?.status === "blocked" && (
            <div role="alert" className="flex flex-col gap-1">
              <Chip tone="warn">{t("blocked", lang)}</Chip>
              <p className="text-sm text-muted">{guideText("credit", lang)}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-bold text-muted">
              {tf("stepNumbered", lang, { n: k })} {step.title[lang]} ·{" "}
              <span className="num">{step.effects.filter((e) => e.category !== "skin_smooth").map((e) => `${e.category} ${e.palettes?.[0]?.colorIntensity ?? ""}`).join(" · ")}</span>
            </p>
            <p className="mt-1 text-[16px] font-bold leading-snug">{step.instruction[lang]}</p>
            {showFixNudge && (
              <div ref={nudgeRef} data-testid="lesson-fix-nudge" className="mt-2 flex scroll-mb-44 flex-col gap-2 rounded-xl bg-warning-soft p-3 text-sm font-bold text-warning">
                <p className="flex items-start gap-2 whitespace-normal break-words leading-snug">
                  <Icon name="warn" className="mt-0.5 h-4 w-4 flex-none" />
                  <span className="min-w-0 flex-1"><span className="lg:hidden">{t("lessonFixCardPrefix", lang)} </span>{t("lessonFixNudge", lang)}</span>
                </p>
                <Button variant="ghost" className="self-start" onClick={() => setFixOpen(true)}>
                  <Icon name="pencil" className="h-4 w-4" />
                  {t("lessonFixNudgeCta", lang)}
                </Button>
              </div>
            )}
            {eyeStep && (
              <>
                <button
                  type="button"
                  onClick={() => setTechnique((v) => !v)}
                  aria-pressed={technique}
                  data-testid="technique-toggle"
                  className={`mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${technique ? "bg-peach-soft text-primary-strong ring-2 ring-primary" : "border border-line-strong/50 bg-panel text-muted"}`}
                >
                  <Icon name="sparkle" className="h-4 w-4" />
                  {t("showTechnique", lang)}
                </button>
                {technique && <p className="mt-1 text-xs text-muted">{t(eyelid === "monolid" ? "techniqueMono" : "techniqueDouble", lang)} {t("techniqueNote", lang)}</p>}
              </>
            )}
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-bold text-muted">{t("intensityLabel", lang)}</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {INTENSITY_SCALES.map((sc) => {
                const current = (lessonScales?.[k] ?? 1) === sc;
                const busy = state?.status === "pending";
                return (
                  <button
                    key={sc}
                    type="button"
                    aria-pressed={current}
                    disabled={busy || current}
                    onClick={() => void setStepScale(id, k, sc)}
                    className={`min-h-12 rounded-[var(--radius-button)] px-2 text-sm font-bold transition-colors duration-200 disabled:cursor-not-allowed ${
                      current ? "bg-peach-soft text-primary-strong ring-2 ring-primary" : "border border-line-strong/50 bg-panel text-ink hover:bg-panel-2 disabled:text-muted"
                    }`}
                  >
                    {t(sc === 1 ? "intensityBase" : sc < 1 ? "intensityLighter" : "intensityStronger", lang)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">{t(sample ? "samplePreviewCost" : "intensityCost", lang)}</p>
          </fieldset>
          {step.reasons.length > 0 && (
            <div className="rounded-xl bg-peach-soft p-3">
              <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} className="flex min-h-10 w-full items-center gap-2 text-left text-sm font-extrabold text-primary-strong">
                <Icon name="sparkle" className="h-4 w-4" />
                {t("whyYou", lang)}: {step.reasons.map((r) => r.label[lang]).join(" + ")}
              </button>
              {whyOpen && (
                <ul className="mt-1 flex flex-col gap-1.5 text-sm leading-relaxed">
                  {step.reasons.map((r, i) => (
                    <li key={i}>
                      <span className="font-bold">{ATTR_NAME[r.attr][lang]}</span> — {r.why[lang]}
                      {r.basis && <span className="mt-1 block text-xs text-muted">{r.basis[lang]}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5" aria-label={t("colorsUsed", lang)}>
            {step.colors.map((c, i) => (
              <Swatch key={`${c.hex}-${i}`} hex={c.hex} />
            ))}
          </div>
        </section>
      </main>
      <BottomBar>
        <div className="flex flex-col gap-2">
          <UnitLine costKey="renderCost" />
          <div className="flex gap-2">
            <ButtonLink href={`/shop?lesson=${id}&step=${k}`} variant="ghost" className="flex-none whitespace-nowrap px-4" aria-label={t("shopStep", lang)}>
              <Icon name="bag" className="h-4 w-4" />
              {t("shopShort", lang)}
            </ButtonLink>
            {last && sample ? (
              <Button
                className="min-w-0 flex-1 px-3 leading-tight"
                disabled={attemptBusy}
                onClick={async () => {
                  setAttemptBusy(true);
                  try {
                    await loadSampleAttempt(answerImage);
                    router.push(`/grade?lesson=${id}`);
                  } finally {
                    setAttemptBusy(false);
                  }
                }}
              >
                <Icon name="check" className="h-4 w-4" />
                {t("sampleAttempt", lang)}
              </Button>
            ) : last ? (
              <ButtonLink href={`/capture?for=attempt&lesson=${id}`} className="min-w-0 flex-1 px-3 leading-tight">
                <Icon name="camera" className="h-4 w-4" />
                {t("takeAttempt", lang)}
              </ButtonLink>
            ) : (
              <Button className="min-w-0 flex-1 px-3" onClick={() => setK((v) => Math.min(plan.steps.length, v + 1))}>
                {t("nextStep", lang)}
              </Button>
            )}
          </div>
        </div>
      </BottomBar>

      <Sheet open={fixOpen} onClose={() => setFixOpen(false)} title={`${ATTR_NAME.eyelid[lang]} — ${t("editTitle", lang)}`}>
        {stored && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{ATTR_NAME.eyelid[lang]}</legend>
            {PROFILE_OPTIONS.eyelid.map((opt) => (
              <label key={opt} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ${stored.profile.eyelid === opt ? "bg-peach-soft" : "bg-panel-2"}`}>
                <input
                  type="radio"
                  name="eyelid"
                  checked={stored.profile.eyelid === opt}
                  onChange={() => {
                    editProfile("eyelid", opt);
                    setFixOpen(false);
                  }}
                  className="h-5 w-5 accent-[var(--color-primary)]"
                />
                <span className="text-[15px] font-bold">{valueLabel("eyelid", opt, lang)}</span>
              </label>
            ))}
            <p className="pt-1 text-xs text-muted">{t("fixHint", lang)}</p>
          </fieldset>
        )}
      </Sheet>
    </Screen>
  );
}

export default function LessonPage() {
  return (
    <Suspense>
      <LessonInner />
    </Suspense>
  );
}
