"use client";

import { Button, Chip, Icon } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { guideText } from "@/lib/quality/messages";
import { baseChanges, CONCERN_NAME, LEVEL_NAME, SKIN_CONCERN_KEYS, type SkinLevel } from "@/lib/skin/concerns";

const LEVEL_TONE: Record<SkinLevel, "ok" | "warn" | "bad"> = { clear: "ok", mild: "warn", noticeable: "bad" };
const BAR: Record<SkinLevel, string> = { clear: "bg-success", mild: "bg-warning", noticeable: "bg-primary" };

/**
 * Opt-in Skin check on /analyze. Live: one YouCam Skin Analysis call (9 units) when the visitor taps the button. Sample trial: the
 * pre-generated result is shown at once (0 units) and labelled as such. Each concern that is not clear maps to one Base-step change.
 */
export function SkinCheckCard({ allowRun }: { allowRun: boolean }) {
  const { lang, sample, skinCheck, skinBusy, skinError, runSkinCheck } = useFlow();
  const changes = baseChanges(skinCheck);

  if (!skinCheck) {
    if (sample) return null; // arrives within a moment
    if (!allowRun && !skinBusy) return null;
    return (
      <section aria-labelledby="skin-check" data-testid="skin-check-card" className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-dashed border-line-strong bg-panel p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="skin-check" className="text-[15px] font-extrabold">
            {t("skinCheckTitle", lang)}
          </h2>
          <Chip tone="neutral">{t("skinCheckOptional", lang)}</Chip>
        </div>
        <p className="text-sm text-muted">{t("skinCheckPitch", lang)}</p>
        {skinError && (
          <p role="alert" className="text-sm font-bold text-warning">
            {t("skinCheckFailed", lang)} {guideText(skinError, lang)}
          </p>
        )}
        <Button variant="ghost" className="w-full" disabled={skinBusy} onClick={() => void runSkinCheck()} data-testid="skin-check-run">
          <Icon name="sparkle" className="h-4 w-4" />
          {skinBusy ? t("skinCheckRunning", lang) : t("skinCheckRun", lang)}
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="skin-check" data-testid="skin-check-card" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="skin-check" className="text-[15px] font-extrabold">
          {t("skinCheckTitle", lang)}
        </h2>
        <Chip tone="neutral">{t(skinCheck.source === "sample" ? "skinCheckBySample" : "skinCheckByLive", lang)}</Chip>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 min-[380px]:grid-cols-2">
        {SKIN_CONCERN_KEYS.map((k) => {
          const r = skinCheck.readings.find((x) => x.key === k);
          if (!r) return null;
          return (
            <li key={k} className="flex flex-col gap-1" data-testid={`skin-reading-${k}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-bold">{CONCERN_NAME[k][lang]}</span>
                <span className="num text-xs font-bold text-muted">{r.score}/100</span>
              </div>
              <div className="h-2 rounded-full bg-panel-2" role="img" aria-label={`${CONCERN_NAME[k][lang]} ${r.score}/100, ${LEVEL_NAME[r.level][lang]}`}>
                <div className={`h-2 rounded-full ${BAR[r.level]}`} style={{ width: `${r.score}%` }} />
              </div>
              <span className="inline-flex">
                <Chip tone={LEVEL_TONE[r.level]}>{LEVEL_NAME[r.level][lang]}</Chip>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="rounded-xl bg-peach-soft p-3" data-testid="skin-base-changes">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-primary-strong">
          <Icon name="sparkle" className="h-4 w-4" />
          {t("skinCheckChanges", lang)}
        </p>
        {changes.length === 0 ? (
          <p className="mt-1 text-sm">{t("skinCheckNone", lang)}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1.5 text-sm leading-relaxed">
            {changes.map((c) => (
              <li key={c.key}>
                <span className="font-bold">{CONCERN_NAME[c.key][lang]}</span> — {c.change[lang]}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        {t("skinCheckNote", lang)} {t("skinCheckRender", lang)}
        {skinCheck.source === "sample" && <> {t("skinCheckSampleNote", lang)}</>}
      </p>
    </section>
  );
}

/** One-line "why this fits you" reason for the Base step: the concerns that changed it. */
export function skinReasonLine(lang: "ko" | "en", changes: ReturnType<typeof baseChanges>): string {
  return changes.map((c) => tf("skinCheckWhyLine", lang, { concern: CONCERN_NAME[c.key][lang], score: c.score })).join(" + ");
}
