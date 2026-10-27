"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar, BottomBar, Button, ButtonLink, Chip, Icon, ModeBanner, Screen, Sheet } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t } from "@/lib/i18n";
import { profileSummary } from "@/lib/labels";
import { LESSONS, recommendLesson } from "@/lib/lessons";

/** Onboarding (M1 entry, consent) and the returning-user home (flow B: profile → lesson, no re-analysis). */
export default function Home() {
  const { lang, consented, setConsented, stored, hydrated, deleteProfile, completed, photo, endSession } = useFlow();
  const router = useRouter();
  const [consentOpen, setConsentOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const begin = (next: string) => {
    if (consented) router.push(next);
    else setConsentOpen(true);
  };

  const rec = stored ? recommendLesson(stored.profile) : null;
  const next = rec ? `/capture?lesson=${rec.lessonId}` : "/capture";

  return (
    <Screen>
      <AppBar title={t("appName", lang)} />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        {!hydrated ? (
          <div className="skeleton h-40 rounded-[var(--radius-panel)]" aria-busy="true" />
        ) : stored && rec ? (
          <>
            <section aria-labelledby="greet" className="flex flex-col gap-2">
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
            </section>
            <section aria-label={t("progress", lang)} className="flex flex-col gap-2">
              <p className="text-sm font-bold">{t("progress", lang)}</p>
              <ul className="grid grid-cols-3 gap-2">
                {LESSONS.map((l) => (
                  <li key={l.id} className={`rounded-xl p-3 text-xs ${completed[l.id] ? "bg-panel" : "border border-dashed border-line-strong/40"}`}>
                    <p className="font-bold">{l.title[lang]}</p>
                    {completed[l.id] ? <p className="num mt-1 text-lg font-extrabold text-primary">{completed[l.id]}</p> : <p className="mt-1 text-muted">—</p>}
                  </li>
                ))}
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
          <section className="flex flex-col gap-4">
            <Chip tone="accent" icon="sparkle">
              YouCam Face Analyzer + Makeup VTO
            </Chip>
            <h2 className="text-[28px] font-extrabold leading-tight">{t("tagline", lang)}</h2>
            <p className="text-[16px] leading-relaxed text-muted">{t("heroBody", lang)}</p>
            <ol className="mt-2 flex flex-col gap-3 text-sm">
              {[
                { ko: "셀피 1장 → 눈꺼풀·입술·얼굴형 읽기 (10 유닛)", en: "1 selfie → eyelids, lips, face shape (10 units)" },
                { ko: "내 얼굴에 단계별 정답 그리기 (단계당 1 유닛)", en: "Step-by-step answers on your face (1 unit/step)" },
                { ko: "내가 그린 결과를 부위별로 채점 (0 유닛)", en: "Grade what you drew, by region (0 units)" },
              ].map((s, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-panel p-3">
                  <span className="num flex h-8 w-8 flex-none items-center justify-center rounded-full bg-peach-soft font-extrabold text-primary">{i + 1}</span>
                  {s[lang]}
                </li>
              ))}
            </ol>
          </section>
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
      <BottomBar>
        <Button className="w-full" onClick={() => begin(stored ? next : "/capture")}>
          {stored ? t("startLesson", lang) : t("start", lang)}
        </Button>
      </BottomBar>

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
