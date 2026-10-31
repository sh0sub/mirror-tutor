"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppBar, ButtonLink, Icon, ModeBanner, Screen, TabBar } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { LESSONS, getLesson } from "@/lib/lessons";

type Seg = "original" | "answer" | "attempt";
const SEGS: Seg[] = ["original", "answer", "attempt"];
const SWIPE_PX = 48;
const HOLD_MS = 400;

/** M5: original / answer / attempt segmented compare. Images are in-memory only (privacy), scores come from the local practice log. */
function RecordInner() {
  const { lang, photo, renders, attempt, gradedLesson, practice, completed, mode } = useFlow();
  const params = useSearchParams();
  const requested = params.get("lesson");
  const fallback = LESSONS.find((l) => practice.scores[l.id] !== undefined || completed[l.id] !== undefined)?.id ?? "daily-k";
  const [lessonId, setLessonId] = useState(getLesson(requested ?? "") ? (requested as string) : fallback);
  const lesson = getLesson(lessonId)!;

  const answerState = renders[lessonId]?.[4];
  const answerImg = answerState?.status === "done" ? answerState.image : null;
  const originalImg = mode === "demo" ? "/demo/sample-model.svg" : (photo?.url ?? null);
  const attemptImg = attempt && gradedLesson === lessonId ? attempt.url : null;
  const images: Record<Seg, string | null> = { original: originalImg, answer: answerImg, attempt: attemptImg };
  const score = practice.scores[lessonId] ?? completed[lessonId];
  const hasAny = Boolean(originalImg || answerImg);

  const [seg, setSeg] = useState<Seg>(attemptImg ? "attempt" : answerImg ? "answer" : "original");
  const [peek, setPeek] = useState(false);
  const shown: Seg = peek ? "original" : seg;

  // swipe between enabled segments; long press peeks at the original and snaps back on release
  const start = useRef<{ x: number; at: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = SEGS.filter((s) => s !== "attempt" || attemptImg);
  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, at: Date.now() };
    holdTimer.current = setTimeout(() => setPeek(true), HOLD_MS);
  };
  const onUp = (e: React.PointerEvent) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPeek(false);
    const s = start.current;
    start.current = null;
    if (!s || Date.now() - s.at >= HOLD_MS) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE_PX) return;
    const i = enabled.indexOf(seg);
    const nextSeg = enabled[Math.min(enabled.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))];
    setSeg(nextSeg);
  };
  const onCancel = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    start.current = null;
    setPeek(false);
  };

  const segLabel = (s: Seg) => t(s === "original" ? "original" : s === "answer" ? "answer" : "attempt", lang);
  const caption =
    score !== undefined && attemptImg ? tf("recordCaption", lang, { lesson: lesson.title[lang], score }) : tf("recordCaptionNoAttempt", lang, { lesson: lesson.title[lang] });

  return (
    <Screen>
      <AppBar title={t("recordTitle", lang)} backHref="/" />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        <div role="group" aria-label={t("pastResults", lang)} className="flex gap-1.5 overflow-x-auto">
          {LESSONS.map((l) => {
            const sc = practice.scores[l.id] ?? completed[l.id];
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={l.id === lessonId}
                onClick={() => {
                  setLessonId(l.id);
                  setSeg("original");
                }}
                className={`min-h-10 flex-none rounded-full px-3 text-xs font-bold ${l.id === lessonId ? "bg-ink text-canvas" : "bg-panel-2 text-muted"}`}
              >
                {l.title[lang]} {sc !== undefined ? <span className="num">· {sc}</span> : `· ${t("notAttempted", lang)}`}
              </button>
            );
          })}
        </div>

        {hasAny ? (
          <>
            <div role="tablist" aria-label={t("recordTitle", lang)} className="grid h-10 grid-cols-3 rounded-full bg-panel-2 p-0.5 text-sm font-bold">
              {SEGS.map((s) => {
                const locked = s === "attempt" && !attemptImg;
                return (
                  <button
                    key={s}
                    role="tab"
                    type="button"
                    aria-selected={seg === s}
                    disabled={locked}
                    title={locked ? t("attemptLocked", lang) : undefined}
                    onClick={() => setSeg(s)}
                    className={`rounded-full ${seg === s ? "bg-panel text-ink shadow-sm" : "text-muted"} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {segLabel(s)}
                  </button>
                );
              })}
            </div>
            <div
              className="relative aspect-[4/5] w-full touch-pan-y select-none overflow-hidden rounded-[var(--radius-panel)] bg-panel-2"
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onPointerLeave={onCancel}
            >
              {SEGS.map(
                (s) =>
                  images[s] && (
                    // eslint-disable-next-line @next/next/no-img-element -- in-memory image
                    <img
                      key={s}
                      src={images[s]!}
                      alt={`${segLabel(s)} · ${lesson.title[lang]}`}
                      draggable={false}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${shown === s ? "opacity-100" : "opacity-0"}`}
                    />
                  ),
              )}
              <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-canvas">{segLabel(shown)}</span>
              {seg === "attempt" && !images.attempt && (
                <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">{t("attemptLocked", lang)}</p>
              )}
            </div>
            <p className="text-center text-sm font-bold">{caption}</p>
            <p className="text-center text-xs text-muted">{t("holdOriginal", lang)}</p>
          </>
        ) : (
          <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-4">
            <p className="text-sm leading-relaxed text-muted">{t("recordEmpty", lang)}</p>
          </section>
        )}

        <div className="flex gap-2">
          <ButtonLink href={`/capture?lesson=${lessonId}`} variant="ghost" aria-label={t("retakeLesson", lang)} className="w-12 flex-none px-0">
            <Icon name="camera" />
          </ButtonLink>
          {attemptImg && answerImg ? (
            <ButtonLink href={`/share?lesson=${lessonId}`} className="flex-1">
              <Icon name="share" className="h-4 w-4" />
              {t("makeCard", lang)}
            </ButtonLink>
          ) : (
            <ButtonLink href={`/capture?lesson=${lessonId}`} className="flex-1">
              <Icon name="camera" className="h-4 w-4" />
              {t("startLesson", lang)}
            </ButtonLink>
          )}
        </div>
      </main>
      <TabBar active="record" lessonId={lessonId} />
    </Screen>
  );
}

export default function RecordPage() {
  return (
    <Suspense>
      <RecordInner />
    </Suspense>
  );
}
