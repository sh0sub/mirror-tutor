"use client";

import { Button, Chip, Icon } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { guideText } from "@/lib/quality/messages";
import type { Pt } from "@/lib/grade/landmarks";
import { zonesView, type SkinZones } from "@/lib/skin/zones";
import { baseChanges, CONCERN_NAME, LEVEL_NAME, SKIN_CONCERN_KEYS, type SkinConcernKey, type SkinLevel } from "@/lib/skin/concerns";

const LEVEL_TONE: Record<SkinLevel, "ok" | "warn" | "bad"> = { clear: "ok", mild: "warn", noticeable: "bad" };
/** Zone colours: distinct hues (not the level colours) so each legend swatch maps to one area. */
const ZONE_COLOR: Record<SkinConcernKey, string> = { dark_circle: "#6d4cff", redness: "#e0245e", pores: "#0b8fa8", oiliness: "#d98200" };
const BAR: Record<SkinLevel, string> = { clear: "bg-success", mild: "bg-warning", noticeable: "bg-primary" };

/**
 * Opt-in Skin check on /analyze. Live: one YouCam Skin Analysis call (9 units) when the visitor taps the button. Sample trial: the
 * pre-generated result is shown at once (0 units) and labelled as such. Each concern that is not clear maps to one Base-step change.
 */
export function SkinCheckCard({ allowRun }: { allowRun: boolean }) {
  const { lang, sample, skinCheck, skinBusy, skinError, runSkinCheck, skinZones, photo, mode } = useFlow();
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
      {skinZones && photo && mode !== "demo" && changes.length > 0 && <SkinZoneFigure src={photo.url} zones={skinZones} keys={changes.map((c) => c.key)} lang={lang} />}
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

const PW = 600;
const PH = 800;
const path = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${(p.x * PW).toFixed(1)},${(p.y * PH).toFixed(1)}`).join("") + "Z";

/** The user's photo cropped to the flagged areas, with only the zones whose rule fired, a legend and the honesty note. */
function SkinZoneFigure({ src, zones, keys, lang }: { src: string; zones: SkinZones; keys: SkinConcernKey[]; lang: "ko" | "en" }) {
  const view = zonesView(keys.flatMap((k) => zones[k]));
  return (
    <figure className="flex flex-col gap-1.5" data-testid="skin-zones">
      <svg
        viewBox={`${view.x * PW} ${view.y * PH} ${view.w * PW} ${view.h * PH}`}
        role="img"
        aria-label={t("skinZonesAlt", lang)}
        className="block h-auto w-full overflow-hidden rounded-xl bg-panel-2"
        style={{ aspectRatio: `${view.w * PW} / ${view.h * PH}` }}
      >
        <image href={src} x={0} y={0} width={PW} height={PH} preserveAspectRatio="none" />
        {keys.map((k) =>
          zones[k].map((poly, i) => (
            <path key={`${k}${i}`} d={path(poly)} data-zone={k} fill={ZONE_COLOR[k]} fillOpacity={0.28} stroke="#fff" strokeWidth={1.8} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )),
        )}
      </svg>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
        {keys.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-white shadow-sm" style={{ background: ZONE_COLOR[k] }} aria-hidden />
            {CONCERN_NAME[k][lang]}
          </li>
        ))}
      </ul>
      <figcaption className="text-xs text-muted">{t("skinZonesNote", lang)}</figcaption>
    </figure>
  );
}
