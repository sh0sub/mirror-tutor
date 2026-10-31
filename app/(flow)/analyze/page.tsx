"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppBar, BottomBar, Button, ButtonLink, Chip, Icon, ModeBanner, Screen, Sheet, UnitLine } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { PhotoPins, type PhotoPin } from "@/components/PhotoPins";
import { estimateLabelWidth } from "@/lib/pinLayout";
import { t, tf, type MsgKey } from "@/lib/i18n";
import { postAnalyze } from "@/lib/client/api";
import { ATTR_NAME, VALUE_HINT, profileSummary, valueLabel } from "@/lib/labels";
import { PROFILE_KEYS, PROFILE_OPTIONS, type FaceProfile, type ProfileKey } from "@/lib/profile";
import { LESSONS, recommendLesson } from "@/lib/lessons";
import { eyelidRuleRows } from "@/lib/rules/engine";
import { guideText, type GuideKey } from "@/lib/quality/messages";
import { getShade, SHADES } from "@/lib/skin/shades";
import type { SkinWarning } from "@/lib/skin/measure";

const SKIN_WARNING: Record<SkinWarning, MsgKey> = { uneven_light: "skinLowUneven", too_dark: "skinLowDark", too_bright: "skinLowBright" };

/** Mockup order: eyelid full width, then 2×2 (eye shape, face shape / lips, brows). */
const CARD_ORDER: ProfileKey[] = ["eyelid", "eyeShape", "faceShape", "lipShape", "eyebrowShape"];
/** Pin chips stay short: drop the parenthetical ("덮이는 눈꺼풀(처진·깊은 눈)" → "덮이는 눈꺼풀"). */
const short = (s: string) => s.replace(/\s*\(.*\)\s*$/, "");

type Phase = { kind: "loading"; slow: boolean } | { kind: "done" } | { kind: "error"; guide: GuideKey; demoAvailable: boolean };

/** M2: analyzing (3-step progress, skeleton cards) → result + correction sheet + recommended lesson. */
export default function AnalyzePage() {
  const { lang, photo, stored, setStored, editProfile, setMode, mode, refreshCredit, skin, setSkinShade, facePins } = useFlow();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(stored && !photo ? { kind: "done" } : { kind: "loading", slow: false });
  const [editing, setEditing] = useState<ProfileKey | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shadeOpen, setShadeOpen] = useState(false);
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
  // Pins only on the user's own photo with real landmarks (demo sample / failed detection → photo only).
  const ownPins = mode !== "demo" ? facePins : null;
  const focus = useMemo(() => (ownPins ? { x: (ownPins.eye.x + ownPins.lip.x) / 2, y: (ownPins.brow.y + ownPins.lip.y) / 2 } : null), [ownPins]);
  const pins = useMemo<PhotoPin[] | null>(() => {
    if (!ownPins || phase.kind !== "done" || !stored) return null;
    const p = stored.profile;
    return [
      { id: "eye", at: ownPins.eye, prefer: "left", text: `${short(valueLabel("eyelid", p.eyelid, lang))} · ${short(valueLabel("eyeShape", p.eyeShape, lang))}` },
      { id: "brow", at: ownPins.brow, prefer: "right", text: short(valueLabel("eyebrowShape", p.eyebrowShape, lang)) },
      { id: "cheek", at: ownPins.cheek, prefer: "left", text: short(valueLabel("faceShape", p.faceShape, lang)) },
      { id: "lip", at: ownPins.lip, prefer: "right", text: short(valueLabel("lipShape", p.lipShape, lang)) },
    ];
  }, [ownPins, phase.kind, stored, lang]);
  const doneChip = phase.kind === "done" && !!stored;
  const badge = useMemo(
    () => (doneChip ? { node: <Chip tone="ok">{t("analyzeDone", lang)}</Chip>, w: estimateLabelWidth(t("analyzeDone", lang), 12, 10) + 18, h: 24 } : undefined),
    [doneChip, lang],
  );
  // Skin shade: only for the user's own photo (the demo sample model keeps the lessons' default base color).
  const showSkin = !!skin && mode !== "demo";
  const shade = skin?.shadeId ? getShade(skin.shadeId) : undefined;
  const measuredShade = skin?.measuredId ? getShade(skin.measuredId) : undefined;
  const skinHint = !skin
    ? ""
    : skin.overridden
      ? measuredShade
        ? tf("skinPicked", lang, { shade: measuredShade.name[lang] })
        : t("skinPickedNoMeasure", lang)
      : measuredShade
        ? tf("skinWhy", lang, { shade: measuredShade.name[lang] })
        : t("skinFailed", lang);

  return (
    <Screen>
      <AppBar title={t("analyzeTitle", lang)} backHref="/capture" />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <section className="flex flex-col gap-3">
          {thumb && (
            <PhotoPins src={thumb} alt={t("myFace", lang)} pins={pins} focus={focus} badge={badge} className="aspect-[3/2] w-full rounded-[var(--radius-panel)]" />
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
                {!thumb && (
                  <span className="inline-flex">
                    <Chip tone="ok">{t("analyzeDone", lang)}</Chip>
                  </span>
                )}
                <p className="text-[16px] font-extrabold leading-snug">{profileSummary(stored.profile, lang)}</p>
                <p className="text-sm text-muted">{t("fixHint", lang)}</p>
              </>
            )}
            {phase.kind === "error" && (
              <div role="alert" className="flex flex-col gap-2">
                <span className="inline-flex">
                  <Chip tone="bad">{t("analyzeFailed", lang)}</Chip>
                </span>
                <p className="text-[15px] font-bold">{guideText(phase.guide, lang)}</p>
                <p className="text-xs text-muted">{t("notBilled", lang)}</p>
              </div>
            )}
          </div>
        </section>

        {phase.kind === "loading" && (
          <div className="flex flex-col gap-2" aria-hidden>
            <p className="flex items-baseline justify-between text-sm font-bold">
              {t("readingItems", lang)} <span className="text-xs font-medium text-muted">{t("attrCount", lang)}</span>
            </p>
            {PROFILE_KEYS.map((k) => (
              <div key={k} className="skeleton h-[72px] rounded-[var(--radius-panel)]" />
            ))}
            <p className="pt-1 text-center text-xs text-muted">{t("noStore", lang)}</p>
          </div>
        )}

        {phase.kind === "done" && stored && (
          <>
            <ul className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
              {CARD_ORDER.map((k) => {
                const v = stored.profile[k];
                const hint = (VALUE_HINT[k] as Record<string, { ko: string; en: string }> | undefined)?.[v as string];
                const wide = k === "eyelid";
                return (
                  <li key={k} className={wide ? "min-[380px]:col-span-2" : undefined}>
                    <button
                      type="button"
                      onClick={() => setEditing(k)}
                      className={`flex h-full min-h-[72px] w-full items-center gap-2 rounded-[var(--radius-panel)] border bg-panel p-3 text-left hover:bg-panel-2 ${wide ? "border-peach" : "border-transparent"}`}
                      aria-label={`${ATTR_NAME[k][lang]}: ${valueLabel(k, v, lang)}. ${t("editTitle", lang)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-muted">
                          {ATTR_NAME[k][lang]} <span className="font-normal">· {k}</span>
                        </p>
                        <p className="text-[16px] font-extrabold leading-snug">{valueLabel(k, v, lang)}</p>
                        {stored.source?.[k] && !stored.edited.includes(k) && <p className="text-xs text-muted">({stored.source[k]})</p>}
                        {stored.edited.includes(k) && (
                          <span className="mt-1 inline-flex">
                            <Chip tone="accent">{t("edited", lang)}</Chip>
                          </span>
                        )}
                        {hint && <p className="mt-0.5 text-xs text-muted">{hint[lang]}</p>}
                      </div>
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-panel-2 text-muted" aria-hidden>
                        <Icon name="pencil" className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {showSkin && skin && (
              <button
                type="button"
                onClick={() => setShadeOpen(true)}
                disabled={skin.detecting}
                className="flex min-h-[72px] w-full items-center gap-3 rounded-[var(--radius-panel)] bg-panel p-3 text-left hover:bg-panel-2 disabled:hover:bg-panel"
                aria-label={`${t("skinTitle", lang)}: ${shade?.name[lang] ?? t("skinDefaultValue", lang)}. ${t("skinPickTitle", lang)}`}
              >
                <span className={`h-10 w-10 flex-none rounded-full border border-ink/10 ${skin.detecting ? "skeleton" : ""}`} style={shade ? { background: shade.hex } : undefined} aria-hidden />
                <div className="min-w-0 flex-1" aria-live="polite">
                  <p className="text-xs font-bold text-muted">{t("skinTitle", lang)}</p>
                  {skin.detecting ? (
                    <p className="text-sm text-muted">{t("skinMeasuring", lang)}</p>
                  ) : (
                    <>
                      <p className="text-[16px] font-extrabold">
                        {shade?.name[lang] ?? t("skinDefaultValue", lang)} {shade && <span className="num text-xs font-medium text-muted">{shade.hex}</span>}
                      </p>
                      <p className="text-xs text-muted">{skinHint}</p>
                      {skin.measured?.warning && !skin.overridden && (
                        <span className="mt-1 inline-flex">
                          <Chip tone="warn">{t(SKIN_WARNING[skin.measured.warning], lang)}</Chip>
                        </span>
                      )}
                    </>
                  )}
                </div>
                {skin.overridden && <Chip tone="accent">{t("edited", lang)}</Chip>}
                <Icon name="pencil" className="h-4 w-4 flex-none text-muted" />
              </button>
            )}

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

      <Sheet open={shadeOpen} onClose={() => setShadeOpen(false)} title={t("skinPickTitle", lang)}>
        {skin && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("skinTitle", lang)}</legend>
            {SHADES.map((s) => (
              <label key={s.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ${skin.shadeId === s.id ? "bg-peach-soft" : "bg-panel-2"}`}>
                <input
                  type="radio"
                  name="skinShade"
                  checked={skin.shadeId === s.id}
                  onChange={() => {
                    setSkinShade(s.id);
                    setShadeOpen(false);
                  }}
                  className="h-5 w-5 accent-[var(--color-primary)]"
                />
                <span className="h-7 w-7 flex-none rounded-full border border-ink/10" style={{ background: s.hex }} aria-hidden />
                <span className="flex-1 text-[15px] font-bold">{s.name[lang]}</span>
                {skin.measuredId === s.id && <Chip tone="neutral">{t("skinMeasuredTag", lang)}</Chip>}
              </label>
            ))}
            <p className="pt-1 text-xs text-muted">{t("skinCost", lang)}</p>
            <p className="text-xs text-muted">{t("skinPrivacy", lang)}</p>
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
