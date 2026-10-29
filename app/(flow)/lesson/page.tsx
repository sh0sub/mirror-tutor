"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar, BottomBar, Button, ButtonLink, Chip, Icon, ModeBanner, Screen, Swatch, UnitLine } from "@/components/ui";
import { CompareSlider } from "@/components/CompareSlider";
import { useFlow, type StepState } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson, getLesson, INTENSITY_SCALES, type StepScales } from "@/lib/lessons";
import { ATTR_NAME } from "@/lib/labels";
import { guideText } from "@/lib/quality/messages";
import { REGIONS } from "@/lib/regions";

function dotClass(s: StepState | undefined, current: boolean) {
  if (current) return "bg-primary text-on-primary";
  if (s?.status === "done") return "bg-success text-white";
  if (s?.status === "error" || s?.status === "blocked") return "bg-danger-soft text-danger";
  return "border-2 border-dashed border-line-strong/60 text-muted";
}

/** M3 lesson player: skeleton → sequential reveal, before/after slider, step card with "왜 당신은" reasons and hex swatches. */
function LessonInner() {
  const { lang, photo, stored, renders, render, mode, scales, setStepScale } = useFlow();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "daily-k";
  const lesson = getLesson(id);
  const [k, setK] = useState(1);
  const [whyOpen, setWhyOpen] = useState(true);
  const started = useRef<string | null>(null);

  const lessonScales = scales[id];
  const plan = useMemo(
    () => (stored && lesson ? buildLesson(lesson.id, stored.profile, { stepScales: lessonScales as StepScales | undefined }) : null),
    [stored, lesson, lessonScales],
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

  if (!plan || !lesson || !photo) return <Screen>{null}</Screen>;
  const step = plan.steps[k - 1];
  const state = steps[k];
  const before = mode === "demo" ? "/demo/sample-model.svg" : photo.url;
  const after = state?.status === "done" ? state.image : null;
  const last = k === plan.steps.length;
  const boxes = REGIONS[step.region] ?? [];

  return (
    <Screen>
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
      <main className="flex flex-1 flex-col">
        <CompareSlider
          before={before}
          after={after}
          label={t("sliderLabel", lang)}
          beforeLabel={t("myFace", lang)}
          afterLabel={`${t("answer", lang)} · ${tf("answerCumulative", lang, { n: k })}`}
          overlay={
            // 3:4 photo shown object-cover in a 4:5 box → 6.25% of the height is cropped (3.125% top)
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {boxes.map((b, i) => (
                <ellipse key={i} cx={(b.x + b.w / 2) * 100} cy={((b.y + b.h / 2) * 100 - 3.125) / 0.9375} rx={(b.w / 2) * 100 + 2} ry={(b.h / 2 / 0.9375) * 100 + 2} fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="1.5 1.2" />
              ))}
            </svg>
          }
        />

        <nav aria-label={t("stepsNav", lang)} className="flex items-center justify-between gap-1 px-4 py-3">
          {plan.steps.map((s) => {
            const st = steps[s.index];
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => setK(s.index)}
                aria-current={s.index === k ? "step" : undefined}
                className="flex min-h-12 flex-1 flex-col items-center gap-1 text-xs font-bold"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${dotClass(st, s.index === k)}`}>
                  {st?.status === "done" && s.index !== k ? <Icon name="check" className="h-4 w-4" /> : st?.status === "error" ? <Icon name="warn" className="h-4 w-4" /> : s.index}
                </span>
                <span className={s.index === k ? "text-ink" : "text-muted"}>
                  {s.title[lang]}
                  {st?.status === "pending" && s.index !== k ? ` · ${t("stepRendering", lang)}` : ""}
                </span>
              </button>
            );
          })}
        </nav>

        <section className="mx-4 flex flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4" aria-live="polite">
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
            <p className="text-xs text-muted">{t("intensityCost", lang)}</p>
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
            <ButtonLink href={`/shop?lesson=${id}&step=${k}`} variant="ghost" className="flex-1">
              <Icon name="bag" className="h-4 w-4" />
              {t("shopStep", lang)}
            </ButtonLink>
            {last ? (
              <ButtonLink href={`/capture?for=attempt&lesson=${id}`} className="flex-[1.4]">
                <Icon name="camera" className="h-4 w-4" />
                {t("takeAttempt", lang)}
              </ButtonLink>
            ) : (
              <Button className="flex-[1.4]" onClick={() => setK((v) => Math.min(plan.steps.length, v + 1))}>
                {t("nextStep", lang)}
              </Button>
            )}
          </div>
        </div>
      </BottomBar>
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
