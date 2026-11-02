"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar, BottomBar, Button, ButtonLink, Icon, ModeBanner, Screen } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { CARD, drawShareCard, type CardContext } from "@/lib/share/card";
import { loadHtmlImage } from "@/lib/client/image";
import { getLesson, LESSONS } from "@/lib/lessons";
import { valueLabel } from "@/lib/labels";

/** M7 share card: built on a client canvas, never uploaded (privacy ⑥). Face blur on by default. */
function ShareInner() {
  const { lang, photo, renders, attempt, grade, gradedLesson, stored, completed, mode, sample, startSample } = useFlow();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const lessonId = useSearchParams().get("lesson") ?? "daily-k";
  const lesson = getLesson(lessonId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blur, setBlur] = useState(true);
  const [hideScore, setHideScore] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const answerState = renders[lessonId]?.[4];
  const answer = answerState?.status === "done" ? answerState.image : null;
  const original = mode === "demo" ? "/demo/sample-model.svg" : (photo?.url ?? null);
  const score = gradedLesson === lessonId && grade?.comparable ? grade.total : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx || !original || !answer) return;
      const [o, a, at] = await Promise.all([loadHtmlImage(original), loadHtmlImage(answer), attempt ? loadHtmlImage(attempt.url) : Promise.resolve(null)]);
      if (cancelled) return;
      c.width = CARD.width * CARD.scale;
      c.height = CARD.height * CARD.scale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawShareCard(ctx as unknown as CardContext, [o, a, at], {
        lessonTitle: lesson?.title[lang] ?? "",
        variant: stored ? `${valueLabel("eyelid", stored.profile.eyelid, lang)} ${t("variant", lang)}` : "",
        score,
        blurFaces: blur,
        hideScore,
        labels: { original: t("original", lang), answer: t("answer", lang), attempt: t("attempt", lang), scoreUnit: t("points", lang), footer: `Mirror Tutor · ${t("tagline", lang)}` },
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [original, answer, attempt, blur, hideScore, lang, lesson, stored, score]);

  const toBlob = () => new Promise<Blob | null>((res) => canvasRef.current?.toBlob(res, "image/png") ?? res(null));

  const save = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mirror-tutor-${lessonId}.png`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(t("saved", lang));
  };

  const shareNative = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], `mirror-tutor-${lessonId}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Mirror Tutor" });
      } catch {
        /* user cancelled */
      }
    } else await save();
  };

  const startFromSample = async () => {
    setStarting(true);
    try {
      await startSample();
      router.push("/analyze");
    } finally {
      setStarting(false);
    }
  };

  const done = LESSONS.filter((l) => completed[l.id]).length;
  const nextLesson = LESSONS.find((l) => !completed[l.id] && l.id !== lessonId) ?? LESSONS.find((l) => !completed[l.id]);

  return (
    <Screen>
      <AppBar title={t("shareTitle", lang)} backHref={`/grade?lesson=${lessonId}`} />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="relative mx-auto w-full max-w-[342px]">
          <canvas ref={canvasRef} className="aspect-[342/428] w-full rounded-[var(--radius-panel)] bg-panel" role="img" aria-label={`${lesson?.title[lang] ?? ""} ${score ?? ""}`} />
          {answer && !ready && <div className="skeleton absolute inset-0 rounded-[var(--radius-panel)]" aria-hidden />}
          {!answer && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-panel)] bg-panel p-6 text-center" data-testid="share-empty">
              <Icon name="sparkle" className="h-6 w-6 text-primary-strong" />
              <p className="text-[15px] font-extrabold">{t("shareEmptyCta", lang)}</p>
              <p className="text-sm leading-relaxed text-muted">{t("shareEmptyHint", lang)}</p>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted">{t("cardLocal", lang)}</p>
        <div className="flex flex-col divide-y divide-line rounded-[var(--radius-panel)] bg-panel">
          {[
            { label: t("blurFaces", lang), sub: "8px", value: blur, set: setBlur },
            { label: t("hideScore", lang), value: hideScore, set: setHideScore },
          ].map((o) => (
            <label key={o.label} className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4">
              <span className="text-[15px] font-bold">
                {o.label} {o.sub && <span className="text-xs font-normal text-muted">{o.sub}</span>}
              </span>
              <input type="checkbox" role="switch" checked={o.value} onChange={(e) => o.set(e.target.checked)} className="h-6 w-11 accent-[var(--color-success)]" />
            </label>
          ))}
        </div>
        <section className="rounded-[var(--radius-panel)] bg-panel p-4">
          <p className="text-sm font-bold">
            {t("progress", lang)} <span className="num">{done} / {LESSONS.length}</span>
          </p>
          <ul className="mt-2 flex gap-1.5">
            {LESSONS.map((l) => (
              <li key={l.id} className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-bold ${completed[l.id] ? "bg-success-soft text-success" : "border border-dashed border-line-strong/40 text-muted"}`}>
                {l.title[lang]}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{nextLesson ? tf("nextLesson", lang, { title: nextLesson.title[lang] }) : t("allLessonsDone", lang)}</p>
        </section>
        {sample && (
          <section aria-labelledby="next-retailer" className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-peach bg-peach-soft p-4" data-testid="retailer-end-card">
            <h2 id="next-retailer" className="text-sm font-extrabold">
              {t("partnerNextTitle", lang)}
            </h2>
            <p className="text-sm leading-relaxed">{t("partnerNextBody", lang)}</p>
            <ButtonLink href="/partner" variant="soft" className="w-full">
              {t("partnerEntry", lang)}
            </ButtonLink>
          </section>
        )}
        {toast && (
          <p role="status" className="rounded-xl bg-ink px-3 py-2 text-center text-sm font-bold text-canvas">
            {toast}
          </p>
        )}
      </main>
      <BottomBar>
        {!answer ? (
          <Button className="w-full" onClick={startFromSample} disabled={starting}>
            <Icon name="sparkle" className="h-4 w-4" />
            {t("shareEmptyCta", lang)}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={shareNative} disabled={!ready}>
              <Icon name="share" className="h-4 w-4" />
              {t("shareNative", lang)}
            </Button>
            <Button className="flex-[1.4]" onClick={save} disabled={!ready}>
              <Icon name="download" className="h-4 w-4" />
              {t("save", lang)}
            </Button>
          </div>
        )}
      </BottomBar>
    </Screen>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareInner />
    </Suspense>
  );
}
