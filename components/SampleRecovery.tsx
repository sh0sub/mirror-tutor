"use client";

import { useEffect, useState } from "react";
import { useFlow } from "@/components/FlowProvider";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { SAMPLE_GRADES, sampleAttemptFor } from "@/lib/demo/sample";
import { t } from "@/lib/i18n";

/** True when a route was opened without a session (cold deep link, reload without a trial) and should offer the one-tap sample trial. */
export function useNoSession(): boolean {
  const { hydrated, restoring, sample, photo } = useFlow();
  return hydrated && !restoring && !sample && !photo;
}

/**
 * Sample trial deep-link fill: once the sample is active, load whatever the route needs from the sample's pre-generated results (0 units):
 * the lesson renders, the simulated attempt photo (`attempt`), and its precomputed grade (`grade`).
 */
export function useSampleFill(lessonId: string, need: { attempt?: boolean; grade?: boolean } = {}): void {
  const { sample, photo, stored, renders, render, attempt, loadSampleAttempt, grade, gradedLesson, setGrade, setGradedLesson, markCompleted } = useFlow();
  const answerState = renders[lessonId]?.[4];
  const answer = answerState?.status === "done" ? answerState.image : null;
  const ready = sample && !!photo && !!stored;

  useEffect(() => {
    if (ready && !renders[lessonId]) void render(lessonId);
  }, [ready, renders, lessonId, render]);

  useEffect(() => {
    if (ready && need.attempt && answer && !attempt) void loadSampleAttempt(answer);
  }, [ready, need.attempt, answer, attempt, loadSampleAttempt]);

  useEffect(() => {
    if (!ready || !need.grade || !answer || !attempt || (gradedLesson === lessonId && grade)) return;
    const preset = SAMPLE_GRADES[sampleAttemptFor(answer) ?? ""];
    if (!preset) return;
    setGrade(preset.grade);
    setGradedLesson(lessonId);
    if (preset.grade.comparable && preset.grade.total !== null) markCompleted(lessonId, preset.grade.total);
  }, [ready, need.grade, answer, attempt, grade, gradedLesson, lessonId, setGrade, setGradedLesson, markCompleted]);
}

/** Dead-end replacement: one primary button starts the 0-unit sample trial in place (profile included), the selfie path stays secondary. */
export function SampleRecoveryCard({ className = "" }: { className?: string }) {
  const { lang, startSample } = useFlow();
  const [busy, setBusy] = useState(false);
  return (
    <section data-testid="sample-recovery" className={`flex flex-col items-center gap-3 rounded-[var(--radius-panel)] bg-panel p-6 text-center ${className}`}>
      <Icon name="sparkle" className="h-6 w-6 text-primary-strong" />
      <h2 className="text-[15px] font-extrabold">{t("sampleRecoverTitle", lang)}</h2>
      <p className="text-sm leading-relaxed text-muted">{t("sampleRecoverBody", lang)}</p>
      <Button
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await startSample(undefined, { withProfile: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="sparkle" className="h-4 w-4" />
        {t("sampleTry", lang)}
      </Button>
      <ButtonLink href="/capture" variant="ghost" className="w-full">
        {t("sampleRecoverOwn", lang)}
      </ButtonLink>
    </section>
  );
}
