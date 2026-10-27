"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppBar, BottomBar, Button, ButtonLink, Chip, Icon, ModeBanner, Screen, Sheet, UnitLine } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t } from "@/lib/i18n";
import { postAnalyze } from "@/lib/client/api";
import { ATTR_NAME, VALUE_HINT, valueLabel } from "@/lib/labels";
import { PROFILE_KEYS, PROFILE_OPTIONS, type FaceProfile, type ProfileKey } from "@/lib/profile";
import { LESSONS, recommendLesson } from "@/lib/lessons";
import { eyelidRuleRows } from "@/lib/rules/engine";
import { guideText, type GuideKey } from "@/lib/quality/messages";

type Phase = { kind: "loading"; slow: boolean } | { kind: "done" } | { kind: "error"; guide: GuideKey; demoAvailable: boolean };

/** M2: analyzing (3-step progress, skeleton cards) → result + correction sheet + recommended lesson. */
export default function AnalyzePage() {
  const { lang, photo, stored, setStored, editProfile, setMode, mode, refreshCredit } = useFlow();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(stored && !photo ? { kind: "done" } : { kind: "loading", slow: false });
  const [editing, setEditing] = useState<ProfileKey | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!photo) {
      if (!stored) router.replace("/capture");
      return;
    }
    if (started.current) return;
    started.current = true;
    const slowTimer = window.setTimeout(() => setPhase((p) => (p.kind === "loading" ? { kind: "loading", slow: true } : p)), 15_000);
    void postAnalyze(photo.blob).then((r) => {
      window.clearTimeout(slowTimer);
      if (r.ok) {
        setStored({ profile: r.profile, edited: [], source: r.source });
        setMode(r.mode);
        setPhase({ kind: "done" });
      } else {
        setPhase({ kind: "error", guide: r.guide, demoAvailable: r.demoAvailable });
      }
      refreshCredit();
    });
    return () => window.clearTimeout(slowTimer);
  }, [photo, stored, router, setStored, setMode, refreshCredit]);

  const thumb = mode === "demo" ? "/demo/sample-model.svg" : photo?.url;
  const rec = stored ? recommendLesson(stored.profile) : null;

  return (
    <Screen>
      <AppBar title={t("analyzeTitle", lang)} backHref="/capture" />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <section className="flex gap-4">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- in-memory object URL, not optimizable
            <img src={thumb} alt={t("myFace", lang)} className="h-40 w-30 flex-none rounded-xl object-cover" width={120} height={160} />
          ) : (
            <div className="h-40 w-30 flex-none rounded-xl bg-panel-2" />
          )}
          <div className="flex min-w-0 flex-col gap-2">
            {phase.kind === "loading" && (
              <>
                <p className="text-[15px] font-bold" role="status" aria-live="polite">
                  {phase.slow ? t("analyzingSlow", lang) : t("analyzing", lang)}
                </p>
                <ol className="flex flex-col gap-1.5 text-sm">
                  {(["stepUpload", "stepAnalyzer", "stepRules"] as const).map((k, i) => (
                    <li key={k} className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-success text-white" : i === 1 ? "bg-primary text-white" : "border border-dashed border-line-strong text-muted"}`}>
                        {i === 0 ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      {t(k, lang)}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {phase.kind === "done" && stored && (
              <>
                <Chip tone="ok">{t("analyzeDone", lang)}</Chip>
                <p className="text-sm text-muted">{t("fixHint", lang)}</p>
              </>
            )}
            {phase.kind === "error" && (
              <div role="alert" className="flex flex-col gap-2">
                <Chip tone="bad">{t("analyzeFailed", lang)}</Chip>
                <p className="text-[15px] font-bold">{guideText(phase.guide, lang)}</p>
                <p className="text-xs text-muted">{t("notBilled", lang)}</p>
              </div>
            )}
          </div>
        </section>

        {phase.kind === "loading" && (
          <div className="flex flex-col gap-2" aria-hidden>
            {PROFILE_KEYS.map((k) => (
              <div key={k} className="skeleton h-[72px] rounded-[var(--radius-panel)]" />
            ))}
            <p className="pt-1 text-center text-xs text-muted">{t("noStore", lang)}</p>
          </div>
        )}

        {phase.kind === "done" && stored && (
          <>
            <ul className="flex flex-col gap-2">
              {PROFILE_KEYS.map((k) => {
                const v = stored.profile[k];
                const hint = (VALUE_HINT[k] as Record<string, { ko: string; en: string }> | undefined)?.[v as string];
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setEditing(k)}
                      className="flex min-h-[72px] w-full items-center gap-3 rounded-[var(--radius-panel)] bg-panel p-3 text-left hover:bg-panel-2"
                      aria-label={`${ATTR_NAME[k][lang]}: ${valueLabel(k, v, lang)}. ${t("editTitle", lang)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-muted">
                          {ATTR_NAME[k][lang]} <span className="font-normal">· {k}</span>
                        </p>
                        <p className="text-[16px] font-extrabold">
                          {valueLabel(k, v, lang)}{" "}
                          {stored.source?.[k] && !stored.edited.includes(k) && <span className="text-xs font-medium text-muted">({stored.source[k]})</span>}
                        </p>
                        {hint && <p className="text-xs text-muted">{hint[lang]}</p>}
                      </div>
                      {stored.edited.includes(k) && <Chip tone="accent">{t("edited", lang)}</Chip>}
                      <Icon name="pencil" className="h-4 w-4 flex-none text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>

            <button type="button" onClick={() => setRulesOpen(true)} className="min-h-12 self-start text-sm font-bold text-primary-strong underline underline-offset-4">
              {t("ruleTable", lang)}
            </button>

            {rec && (
              <section aria-labelledby="rec" className="rounded-[var(--radius-panel)] border-2 border-primary/30 bg-panel p-4">
                <p id="rec" className="text-xs font-bold text-primary-strong">
                  {t("recommended", lang)}
                </p>
                <p className="mt-1 text-lg font-extrabold">
                  {LESSONS.find((l) => l.id === rec.lessonId)!.title[lang]}{" "}
                  <span className="text-sm font-medium text-muted">
                    · 4 {t("steps", lang)} · {LESSONS.find((l) => l.id === rec.lessonId)!.minutes}
                    {t("minutes", lang)}
                  </span>
                </p>
                <p className="text-sm text-muted">{rec.reason[lang]}</p>
                <p className="mt-2 text-xs font-bold text-muted">{t("otherLessons", lang)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {LESSONS.filter((l) => l.id !== rec.lessonId).map((l) => (
                    <Link key={l.id} href={`/lesson?id=${l.id}`} className="inline-flex min-h-12 items-center rounded-full bg-panel-2 px-4 text-sm font-bold">
                      {l.title[lang]}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <BottomBar>
        {phase.kind === "error" ? (
          <div className="flex gap-2">
            <ButtonLink href="/capture" variant={phase.demoAvailable ? "ghost" : "primary"} className="flex-1">
              {t("retake", lang)}
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <UnitLine costKey="analyzerCost" />
            <Button className="w-full" disabled={phase.kind !== "done" || !rec} onClick={() => rec && router.push(`/lesson?id=${rec.lessonId}`)}>
              {t("startLesson", lang)}
            </Button>
          </div>
        )}
      </BottomBar>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? `${ATTR_NAME[editing][lang]} — ${t("editTitle", lang)}` : ""}>
        {editing && stored && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{ATTR_NAME[editing][lang]}</legend>
            {(PROFILE_OPTIONS[editing] as readonly string[]).map((opt) => (
              <label key={opt} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ${stored.profile[editing] === opt ? "bg-peach-soft" : "bg-panel-2"}`}>
                <input
                  type="radio"
                  name={editing}
                  checked={stored.profile[editing] === opt}
                  onChange={() => {
                    editProfile(editing, opt as FaceProfile[typeof editing]);
                    setEditing(null);
                  }}
                  className="h-5 w-5 accent-[var(--color-primary)]"
                />
                <span className="text-[15px] font-bold">{valueLabel(editing, opt as never, lang)}</span>
              </label>
            ))}
            <p className="pt-1 text-xs text-muted">{t("fixHint", lang)}</p>
          </fieldset>
        )}
      </Sheet>

      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} title={t("ruleTableTitle", lang)}>
        <table className="w-full text-left text-sm">
          <tbody>
            {eyelidRuleRows(lang).map((r) => (
              <tr key={r.value} className={`border-b border-line ${stored?.profile.eyelid === r.value ? "bg-peach-soft font-bold" : ""}`}>
                <th scope="row" className="py-2 pr-2 font-bold">
                  {valueLabel("eyelid", r.value as FaceProfile["eyelid"], lang)}
                </th>
                <td className="py-2 pr-2">{r.technique}</td>
                <td className="num py-2 text-xs text-muted">{r.pattern}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="ghost" className="mt-3 w-full" onClick={() => setRulesOpen(false)}>
          {t("close", lang)}
        </Button>
      </Sheet>
    </Screen>
  );
}
