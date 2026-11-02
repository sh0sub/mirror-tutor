import type { Text } from "../rules/engine";

/**
 * Skin check -> base technique. Skin Analysis (YouCam SD, 4 concerns) scores each concern 1-100 (higher = clearer).
 * A hand-written rule table turns a noticeable concern into one change to the lesson's Base step (a prep product or an
 * adjusted layer). It changes the instruction text and the shopping hint, not the Makeup VTO render: VTO paints colour,
 * it cannot show a corrector or a primer, and we do not pretend it does.
 */
export const SKIN_CONCERN_KEYS = ["dark_circle", "redness", "oiliness", "pores"] as const;
export type SkinConcernKey = (typeof SKIN_CONCERN_KEYS)[number];

/** Skin Analysis `dst_actions` name -> concern key. */
export const SKIN_ACTION_TO_KEY: Record<string, SkinConcernKey> = {
  dark_circle_v2: "dark_circle",
  redness: "redness",
  oiliness: "oiliness",
  pore: "pores",
};
export const SKIN_ACTIONS = ["dark_circle_v2", "redness", "oiliness", "pore"] as const;

export type SkinLevel = "clear" | "mild" | "noticeable";

/** Our own thresholds on the API's 1-100 score (higher = clearer): below 70 noticeable, below 85 mild, otherwise clear. */
export const NOTICEABLE_BELOW = 70;
export const MILD_BELOW = 85;

export function skinLevel(score: number): SkinLevel {
  return score < NOTICEABLE_BELOW ? "noticeable" : score < MILD_BELOW ? "mild" : "clear";
}

export interface SkinReading {
  key: SkinConcernKey;
  /** The API's ui_score, 1-100 (higher = clearer). */
  score: number;
  level: SkinLevel;
}

export interface SkinCheck {
  readings: SkinReading[];
  /** "live" = a real Skin Analysis call on the visitor's photo; "sample" = captured once on the sample face and replayed at 0 units. */
  source: "live" | "sample";
}

export const CONCERN_NAME: Record<SkinConcernKey, Text> = {
  dark_circle: { ko: "다크서클", en: "Dark circles" },
  redness: { ko: "붉은기", en: "Redness" },
  oiliness: { ko: "유분", en: "Oiliness" },
  pores: { ko: "모공", en: "Pores" },
};

export const LEVEL_NAME: Record<SkinLevel, Text> = {
  clear: { ko: "깨끗해요", en: "Clear" },
  mild: { ko: "약간", en: "Mild" },
  noticeable: { ko: "눈에 띄어요", en: "Noticeable" },
};

export interface BaseChange {
  key: SkinConcernKey;
  /** The change to the Base step. */
  change: Text;
  /** Why it fits (shown as the reason). */
  why: Text;
}

/** The hand-written rule table: one concern -> one base-technique change. */
export const BASE_RULES: Record<SkinConcernKey, BaseChange> = {
  dark_circle: {
    key: "dark_circle",
    change: { ko: "파운데이션 전에 눈 밑에 피치 컨실러를 얇게 톡톡.", en: "Before foundation, tap a thin peach corrector under the eyes." },
    why: { ko: "다크서클의 푸른 기를 피치색이 상쇄해요.", en: "Peach cancels the blue-purple of dark circles." },
  },
  redness: {
    key: "redness",
    change: { ko: "볼과 콧방울에 그린 프라이머를 얇게 먼저.", en: "Start with a thin green primer on the cheeks and nose." },
    why: { ko: "초록색이 붉은기를 눌러 줘요.", en: "Green tones down redness." },
  },
  oiliness: {
    key: "oiliness",
    change: { ko: "T존에 매트 프라이머, 파운데이션은 더 얇게. 광은 빼요.", en: "Mattifying primer on the T-zone, a thinner foundation layer, and skip the glow." },
    why: { ko: "유분이 많으면 두꺼운 베이스가 쉽게 밀려요.", en: "Oily skin makes a thick base slide." },
  },
  pores: {
    key: "pores",
    change: { ko: "블러 프라이머를 코와 볼에 문지르지 말고 눌러 바르기.", en: "Press a blurring primer into the nose and cheeks; do not rub." },
    why: { ko: "눌러 바르면 모공 위에 얇은 막이 남아요.", en: "Pressing leaves a thin film over the pores." },
  },
};

/** Concerns that change the base: mild or noticeable ones, worst first. */
export function baseChanges(check: SkinCheck | null | undefined): Array<BaseChange & { level: SkinLevel; score: number }> {
  if (!check) return [];
  return check.readings
    .filter((r) => r.level !== "clear")
    .sort((a, b) => a.score - b.score)
    .map((r) => ({ ...BASE_RULES[r.key], level: r.level, score: r.score }));
}
