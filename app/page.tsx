"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppBar, BottomBar, Button, ButtonLink, Chip, Icon, ModeBanner, Screen, Sheet, TabBar } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { guideText } from "@/lib/quality/messages";
import { FACE_NAME, profileSummary, valueLabel } from "@/lib/labels";
import { LESSONS, recommendLesson } from "@/lib/lessons";
import { streakDays, weekDots } from "@/lib/practice";
import { comparePair, type CompareManifest } from "@/lib/demo/compare";
import manifestJson from "@/public/demo/compare.json";

/** Hero: the monolid face and the double-lid face after the same lesson (links to /compare). */
const heroPair = comparePair(manifestJson as CompareManifest);

/** Onboarding (M1 entry, consent) and the returning-user home (flow B: profile → lesson, no re-analysis). */
export default function Home() {
  const { lang, consented, setConsented, stored, hydrated, deleteProfile, completed, photo, endSession, practice, attempt, gradedLesson, sample, startSample, setPhoto } = useFlow();
  const router = useRouter();
  const [consentOpen, setConsentOpen] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  // No selfie, no consent needed: the sample model's pre-generated results, 0 units (the server never calls YouCam for it).
  const startingSample = useRef(false);
  const trySample = async () => {
    startingSample.current = true;
    setSampleBusy(true);
    try {
      await startSample();
      router.push("/analyze");
    } catch {
      startingSample.current = false;
      setToast(guideText("retry", lang));
    } finally {
      setSampleBusy(false);
    }
  };
  // Coming home ends a sample run, so the saved profile (not the sample model's) is what home shows and edits.
  useEffect(() => {
    if (sample && !startingSample.current) setPhoto(null);
  }, [sample, setPhoto]);
  const sampleButton = (
    <Button variant="soft" className="w-full border border-primary/30" onClick={trySample} disabled={sampleBusy} aria-describedby="sample-hint">
      <Icon name="user" className="h-4 w-4" />
      {t("sampleTry", lang)}
    </Button>
  );
  const [toast, setToast] = useState<string | null>(null);

  const begin = (next: string) => {
    if (consented) router.push(next);
    else setConsentOpen(true);
  };

  // Today's lesson: the profile's recommendation until it is done this session, then the next lesson not yet done.
  const base = stored ? recommendLesson(stored.profile) : null;
  const pending = base && completed[base.lessonId] ? LESSONS.find((l) => !completed[l.id]) : undefined;
  const rec = base && pending ? { lessonId: pending.id, reason: pending.summary } : base;
  const next = rec ? `/capture?lesson=${rec.lessonId}` : "/capture";

  const returning = hydrated && !!stored && !!rec;
  const streak = streakDays(practice);
  const dots = weekDots(practice);
  const dayNames = t("weekdays", lang).split(",");
  const score = (id: string) => practice.scores[id] ?? completed[id];

  return (
    <Screen wide={!returning}>
      <AppBar
        title={t("appName", lang)}
        right={
          returning ? (
            <>
              <button type="button" aria-label={t("notifications", lang)} onClick={() => setToast(t("noNotifications", lang))} className="inline-flex h-12 w-10 items-center justify-center rounded-full text-muted hover:bg-panel-2">
                <Icon name="bell" />
              </button>
              <Link href="/#profile" aria-label={t("profileMenu", lang)} className="mr-1 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-peach-soft text-sm font-extrabold text-primary-strong">
                {lang === "ko" ? "나" : "Me"}
              </Link>
            </>
          ) : undefined
        }
      />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        {!hydrated ? (
          <div className="skeleton h-40 rounded-[var(--radius-panel)]" aria-busy="true" />
        ) : stored && rec ? (
          <>
            <section id="profile" aria-labelledby="greet" className="flex scroll-mt-16 flex-col gap-2">
              <h2 id="greet" className="text-[22px] font-extrabold leading-snug">
                {t("homeGreeting", lang)}
              </h2>
              <p className="text-sm text-muted">
                {t("profileLabel", lang)}: {profileSummary(stored.profile, lang)} ({t("deviceOnly", lang)})
              </p>
            </section>
            <section aria-labelledby="today" className="rounded-[var(--radius-panel)] bg-panel p-4">
              <p id="today" className="text-xs font-bold text-muted">
                {t("todayLesson", lang)}
              </p>
              <p className="mt-1 text-lg font-extrabold">{LESSONS.find((l) => l.id === rec.lessonId)!.title[lang]}</p>
              <p className="text-sm text-muted">{rec.reason[lang]}</p>
              <p className="mt-2 text-xs text-muted">{t("newSelfieNote", lang)}</p>
              <Button className="mt-3 w-full" onClick={() => begin(next)}>
                {t("startLesson", lang)}
              </Button>
            </section>
            <section aria-label={t("streakLabel", lang)} className="rounded-[var(--radius-panel)] bg-panel p-4">
              <p className="text-sm font-extrabold">{streak > 0 ? tf("streakDays", lang, { n: streak }) : t("streakStart", lang)}</p>
              {streak > 0 && <p className="text-xs text-muted">{tf("streakNext", lang, { n: streak + 1 })}</p>}
              <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
                {dots.map((d) => (
                  <li key={d.weekday} className="flex flex-col items-center gap-1">
                    <span aria-hidden>{d.today ? t("streakToday", lang) : dayNames[d.weekday]}</span>
                    <span
                      role="img"
                      aria-label={`${dayNames[d.weekday]}${d.done ? " ✓" : ""}`}
                      className={`flex h-7 w-7 items-center justify-center rounded-full ${d.done ? "bg-primary text-on-primary" : d.today ? "border-2 border-primary" : "border-2 border-dashed border-line-strong/40"}`}
                    >
                      {d.done && <Icon name="check" className="h-4 w-4" />}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label={t("pastResults", lang)} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("pastResults", lang)}</p>
                <Link href="/record" className="inline-flex min-h-10 items-center text-xs font-bold text-primary-strong">
                  {t("seeAll", lang)}
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-2">
                {LESSONS.map((l) => {
                  const sc = score(l.id);
                  const shot = sc !== undefined && attempt && gradedLesson === l.id ? attempt.url : null;
                  return (
                    <li key={l.id}>
                      <Link
                        href={sc !== undefined ? `/record?lesson=${l.id}` : `/capture?lesson=${l.id}`}
                        className={`flex min-h-[132px] flex-col justify-between rounded-xl p-2 text-xs ${sc !== undefined ? "bg-panel" : "border border-dashed border-line-strong/40"}`}
                      >
                        <span className="relative flex h-16 items-center justify-center overflow-hidden rounded-lg bg-panel-2">
                          {/* eslint-disable-next-line @next/next/no-img-element -- in-memory image */}
                          {shot && <img src={shot} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                          {sc !== undefined ? (
                            <span className="num relative rounded-full bg-canvas/90 px-2 py-0.5 text-base font-extrabold text-primary">{sc}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </span>
                        <span className="mt-1 font-bold leading-snug">{l.title[lang]}</span>
                        <span className="text-muted">{sc !== undefined ? (stored ? `${valueLabel("eyelid", stored.profile.eyelid, lang)} ${t("variant", lang)}` : "") : t("notAttempted", lang)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/capture" variant="ghost" className="flex-1">
                {t("reanalyze", lang)}
              </ButtonLink>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  deleteProfile();
                  setToast(t("deleted", lang));
                }}
              >
                <Icon name="trash" className="h-4 w-4" />
                {t("deleteProfile", lang)}
              </Button>
            </div>
          </>
        ) : (
          <section className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10">
            <div className="flex flex-col gap-4">
              <Chip tone="accent" icon="sparkle">
                YouCam Face Analyzer + Makeup VTO
              </Chip>
              <h2 className="text-[28px] font-extrabold leading-tight lg:text-[36px]">{t("tagline", lang)}</h2>
              <p className="text-[16px] leading-relaxed text-muted">{t("heroBody", lang)}</p>
              <ol className="mt-2 flex flex-col gap-3 text-sm">
                {(["homeStep1", "homeStep2", "homeStep3"] as const).map((key, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-panel p-3">
                    <span className="num flex h-8 w-8 flex-none items-center justify-center rounded-full bg-peach-soft font-extrabold text-primary">{i + 1}</span>
                    {t(key, lang)}
                  </li>
                ))}
              </ol>
              <p id="sample-hint" className="text-sm text-muted">
                {t("sampleTryHint", lang)}
              </p>
            </div>
            <Link href="/compare" aria-label={t("compareEntry", lang)} className="order-first flex flex-col gap-2 lg:order-none">
              <div className="grid grid-cols-2 gap-2">
                {heroPair
                  .map((m) => ({ src: m.steps[m.steps.length - 1], label: FACE_NAME[m.profile.eyelid][lang] }))
                  .map((im) => (
                  <div key={im.label} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-panel-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static pre-generated demo asset */}
                    <img src={im.src} alt="" width={600} height={800} className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-canvas">{im.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs font-bold text-primary-strong">{t("heroSampleCaption", lang)}</p>
            </Link>
          </section>
        )}
        {hydrated && (
          <ButtonLink href="/compare" variant="ghost" className="w-full">
            <Icon name="sparkle" className="h-4 w-4" />
            {t("compareEntry", lang)}
          </ButtonLink>
        )}
        {returning && (
          <div className="flex flex-col gap-1">
            {sampleButton}
            <p id="sample-hint" className="text-center text-xs text-muted">
              {t("sampleTryHint", lang)}
            </p>
          </div>
        )}
        {photo && (
          <button
            type="button"
            className="min-h-12 self-center text-sm font-bold text-muted underline underline-offset-4"
            onClick={async () => {
              await endSession();
              setToast(t("sessionEnded", lang));
            }}
          >
            {t("endSession", lang)}
          </button>
        )}
        {toast && (
          <p role="status" className="rounded-xl bg-ink px-3 py-2 text-center text-sm font-bold text-canvas">
            {toast}
          </p>
        )}
      </main>
      {returning ? (
        <TabBar active="home" lessonId={rec!.lessonId} />
      ) : (
        <BottomBar>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => begin("/capture")}>
              {t("start", lang)}
            </Button>
            {hydrated && sampleButton}
          </div>
        </BottomBar>
      )}

      <Sheet open={consentOpen} onClose={() => setConsentOpen(false)} title={t("consentTitle", lang)}>
        <p className="text-[15px] leading-relaxed">{t("consentBody", lang)}</p>
        <p className="mt-2 text-sm text-muted">{t("consentLocal", lang)}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConsentOpen(false)}>
            {t("cancel", lang)}
          </Button>
          <Button
            className="flex-[2]"
            onClick={() => {
              setConsented(true);
              setConsentOpen(false);
              router.push(stored ? next : "/capture");
            }}
          >
            {t("agree", lang)}
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
