"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar, BottomBar, ButtonLink, Chip, Icon, ModeBanner, Screen } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { PhotoPins, type PhotoPin } from "@/components/PhotoPins";
import { t } from "@/lib/i18n";
import { postGrade } from "@/lib/client/api";
import { measureLandmarksInBrowser } from "@/lib/client/landmarker";
import { urlToBlob } from "@/lib/client/image";
import { REGION_NAME, scoreBand, type GradeResult } from "@/lib/grade/types";
import type { GradePins } from "@/lib/facePins";
import { estimateLabelWidth } from "@/lib/pinLayout";

/** M4: answer (step 4) vs my attempt → per-region scores, one-line tips, confidence. 0 YouCam units. */
function GradeInner() {
  const { lang, attempt, renders, grade, setGrade, gradedLesson, setGradedLesson, markCompleted, sample } = useFlow();
  const router = useRouter();
  const lessonId = useSearchParams().get("lesson") ?? "daily-k";
  const answerState = renders[lessonId]?.[4];
  const answer = answerState?.status === "done" ? answerState.image : null;
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  // Score-label points from the attempt photo's own landmarks (never the first photo's). null → no overlay.
  const [attemptPins, setAttemptPins] = useState<{ blob: Blob; pins: GradePins | null } | null>(null);
  const started = useRef<Blob | null>(null);

  useEffect(() => {
    if (!attempt || !answer) {
      router.replace(answer ? `/capture?for=attempt&lesson=${lessonId}` : `/lesson?id=${lessonId}`);
      return;
    }
    if (started.current === attempt.blob) return;
    started.current = attempt.blob;
    setGrade(null);
    setError(null);
    void (async () => {
      const answerBlob = await urlToBlob(answer);
      // S1: landmark-aligned ΔE measured on this device; null (no face / offline / unsupported) → F6 grader.
      const { measure, attemptPins: pins } = await measureLandmarksInBrowser(answerBlob, attempt.blob);
      setAttemptPins({ blob: attempt.blob, pins });
      const r = await postGrade(answerBlob, attempt.blob, measure);
      if ("error" in r) setError(r.error);
      else {
        setGrade(r);
        setGradedLesson(lessonId);
        if (r.comparable && r.total !== null) markCompleted(lessonId, r.total);
      }
    })();
  }, [attempt, answer, lessonId, router, setGrade, setGradedLesson, markCompleted]);

  const result: GradeResult | null = gradedLesson === lessonId ? grade : null;
  const pinsNow = attempt && attemptPins?.blob === attempt.blob ? attemptPins.pins : null;
  const scorePins = useMemo<PhotoPin[] | null>(() => {
    if (!result?.comparable || !pinsNow) return null;
    const out = result.regions.flatMap((r) => {
      const at = pinsNow[r.region];
      if (!at) return [];
      const ok = r.score >= 80;
      const name = REGION_NAME[r.region][lang];
      return [
        {
          id: r.region,
          at,
          prefer: "center" as const,
          text: `${name} ${r.score}`,
          extraW: 18,
          content: (
            <>
              <Icon name={ok ? "check" : "warn"} className={`h-3.5 w-3.5 flex-none ${ok ? "text-success" : "text-warning"}`} />
              {name} <span className="num">{r.score}</span>
            </>
          ),
        },
      ];
    });
    return out.length ? out : null;
  }, [result, pinsNow, lang]);
  const captionReserve = useMemo(() => [{ corner: "top-left" as const, w: estimateLabelWidth(t("attempt", lang)), h: 20 }], [lang]);
  const confLabel = result ? t(result.confidence === "high" ? "confHigh" : result.confidence === "medium" ? "confMedium" : "confLow", lang) : "";

  return (
    <Screen>
      <AppBar title={t("gradeTitle", lang)} backHref={`/lesson?id=${lessonId}`} />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { src: answer, label: `${t("answer", lang)} · 4` },
            { src: attempt?.url ?? null, label: sample ? `${t("sampleFace", lang)} · ${t("attempt", lang)}` : t("attempt", lang) },
          ].map((p, i) =>
            i === 1 && p.src ? (
              <PhotoPins key={i} src={p.src} alt={p.label} pins={scorePins} dots={false} reserve={captionReserve} className="aspect-[3/4] rounded-xl">
                <figcaption className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-canvas">{p.label}</figcaption>
              </PhotoPins>
            ) : (
              <figure key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-panel-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- in-memory images */}
                {p.src && <img src={p.src} alt={p.label} className="h-full w-full object-cover" />}
                <figcaption className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold ${i === 0 ? "bg-primary text-on-primary" : "bg-ink/70 text-canvas"}`}>{p.label}</figcaption>
              </figure>
            ),
          )}
        </div>

        {sample && (
          <p data-testid="sample-attempt-note" className="rounded-xl border border-primary/30 bg-peach-soft p-3 text-xs font-bold text-primary-strong">
            {t("sampleAttemptNote", lang)}
          </p>
        )}

        {!result && !error && (
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <p className="text-sm font-bold text-muted">{t("grading", lang)}</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-[var(--radius-panel)]" />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-panel p-4">
            <Chip tone="bad">{t("analyzeFailed", lang)}</Chip>
            <p className="text-sm">{t("notComparableBody", lang)}</p>
          </div>
        )}

        {result && !result.comparable && (
          <div role="alert" className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-panel p-4">
            <Chip tone="warn">{t("notComparable", lang)}</Chip>
            <p className="text-sm text-muted">{t("notComparableBody", lang)}</p>
          </div>
        )}

        {result && result.comparable && result.total !== null && (
          <>
            <section className="flex items-center gap-4 rounded-[var(--radius-panel)] bg-panel p-4" aria-label={`${result.total} / 100`}>
              <div className="relative h-20 w-20 flex-none">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90" aria-hidden>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-panel-2)" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-primary)" strokeWidth="3.5" strokeDasharray={`${(result.total / 100) * 97.4} 97.4`} strokeLinecap="round" />
                </svg>
                <span className="num absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-2xl font-extrabold">{result.total}</span>
                  <span className="mt-0.5 text-xs font-bold text-muted">{t("outOf100", lang)}</span>
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-xs font-bold text-muted">{t("gradeDone", lang)}</p>
                <p className="text-lg font-extrabold">{scoreBand(result.total)[lang]}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={result.confidence === "high" ? "ok" : "warn"}>
                    {t("confidence", lang)} {confLabel}
                  </Chip>
                  {result.confidenceReason && <span className="text-xs text-muted">{result.confidenceReason[lang]}</span>}
                </div>
              </div>
            </section>
            <ul className="flex flex-col gap-2">
              {result.regions.map((r) => (
                <li key={r.region}>
                  <button
                    type="button"
                    onClick={() => setFocus(focus === r.region ? null : r.region)}
                    aria-expanded={focus === r.region}
                    className="flex min-h-16 w-full items-start gap-3 rounded-[var(--radius-panel)] bg-panel p-3 text-left"
                  >
                    <span className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full ${r.score >= 80 ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                      <Icon name={r.score >= 80 ? "check" : "warn"} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-bold">{REGION_NAME[r.region][lang]}</span>
                        <span className="num text-lg font-extrabold">{r.score}</span>
                      </span>
                      <span className="mt-1 block h-1.5 rounded-full bg-panel-2">
                        <span className={`block h-1.5 rounded-full ${r.score >= 80 ? "bg-success" : "bg-warning"}`} style={{ width: `${r.score}%`, transition: "width 400ms" }} />
                      </span>
                      <span className="mt-1.5 block text-sm">{r.tip[lang]}</span>
                      <span className="num mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className="font-bold">ΔE2000 {r.deltaE}</span>
                        {r.answerHex && r.attemptHex && (
                          <span className="flex items-center gap-1" data-testid={`swatch-${r.region}`}>
                            <span className="h-4 w-4 flex-none rounded-full border border-line-strong/50" style={{ background: r.answerHex }} role="img" aria-label={`${t("gradeAnswerSwatch", lang)} ${r.answerHex}`} />
                            <span aria-hidden>vs</span>
                            <span className="h-4 w-4 flex-none rounded-full border border-line-strong/50" style={{ background: r.attemptHex }} role="img" aria-label={`${t("gradeAttemptSwatch", lang)} ${r.attemptHex}`} />
                            <span>{r.answerHex} / {r.attemptHex}</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-center text-xs text-muted">{t(result?.grader === "landmark" ? "gradeFootnoteLandmark" : "gradeFootnote", lang)}</p>
          </>
        )}
      </main>
      <BottomBar>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <ButtonLink href={`/capture?for=attempt&lesson=${lessonId}`} variant="ghost" className="flex-1">
              {t("retake", lang)}
            </ButtonLink>
            <ButtonLink href={`/shop?lesson=${lessonId}&step=4`} className="flex-[1.4]">
              <Icon name="bag" className="h-4 w-4" />
              {t("seeProducts", lang)}
            </ButtonLink>
          </div>
          {result?.comparable && (
            <ButtonLink href={`/share?lesson=${lessonId}`} variant="soft" className="w-full">
              <Icon name="share" className="h-4 w-4" />
              {t("makeCard", lang)}
            </ButtonLink>
          )}
        </div>
      </BottomBar>
    </Screen>
  );
}

export default function GradePage() {
  return (
    <Suspense>
      <GradeInner />
    </Suspense>
  );
}
