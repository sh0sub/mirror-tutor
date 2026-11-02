import type { FaceProfile, ProfileKey } from "./profile";
import type { Lang, Text } from "./rules/engine";

/** Attribute names and values in plain Korean/English (F2 "쉬운 한/영 한 줄 설명"). Drafted, needs human review. */
export const ATTR_NAME: Record<ProfileKey, Text> = {
  eyelid: { ko: "눈꺼풀", en: "Eyelid" },
  eyeShape: { ko: "눈 모양", en: "Eye shape" },
  lipShape: { ko: "입술", en: "Lips" },
  faceShape: { ko: "얼굴형", en: "Face shape" },
  eyebrowShape: { ko: "눈썹", en: "Brows" },
};

export const VALUE_LABEL: { [K in ProfileKey]: Record<FaceProfile[K], Text> } = {
  eyelid: {
    monolid: { ko: "홑꺼풀", en: "Monolid" },
    inner_double: { ko: "속쌍꺼풀", en: "Inner double lid" },
    double: { ko: "쌍꺼풀", en: "Double lid" },
    hooded: { ko: "덮이는 눈꺼풀(처진·깊은 눈)", en: "Hooded lid (deep-set)" },
  },
  eyeShape: {
    almond: { ko: "아몬드형", en: "Almond" },
    round: { ko: "동그란 눈", en: "Round" },
    narrow: { ko: "가는 눈", en: "Narrow" },
  },
  lipShape: {
    thin: { ko: "얇은 입술", en: "Thin lips" },
    average: { ko: "보통 입술", en: "Average lips" },
    full: { ko: "도톰한 입술", en: "Full lips" },
  },
  faceShape: {
    oval: { ko: "달걀형", en: "Oval" },
    round: { ko: "둥근형", en: "Round" },
    oblong: { ko: "긴 얼굴형", en: "Oblong" },
    square: { ko: "각진형", en: "Square" },
    heart: { ko: "하트형", en: "Heart" },
    diamond: { ko: "다이아몬드형", en: "Diamond" },
    triangle: { ko: "삼각형", en: "Triangle" },
  },
  eyebrowShape: {
    straight: { ko: "일자 눈썹", en: "Straight brows" },
    soft_angled: { ko: "부드러운 아치", en: "Soft arch" },
    hard_angled: { ko: "각진 눈썹", en: "Angled brows" },
    rounded: { ko: "둥근 눈썹", en: "Rounded brows" },
    obscured: { ko: "잘 안 보이는 눈썹", en: "Faint brows" },
  },
};

/** One-line plain explanation per value (what it means for makeup). */
export const VALUE_HINT: Partial<{ [K in ProfileKey]: Partial<Record<FaceProfile[K], Text>> }> = {
  eyelid: {
    monolid: { ko: "아이라인은 눈 떴을 때 보이는 두께가 기준이에요", en: "Liner thickness is judged with your eyes open" },
    inner_double: { ko: "주름이 안쪽에 있어 라인을 얇게 잡아요", en: "Your crease is tucked in, so keep liner thin" },
    double: { ko: "주름선이 음영의 가이드가 돼요", en: "Your crease is a built-in shading guide" },
    hooded: { ko: "눈 뜬 상태에서 보이는 위치에 색을 놓아요", en: "Place color where it shows with eyes open" },
  },
  lipShape: {
    thin: { ko: "그라데이션 립이 잘 어울려요", en: "Gradient lips suit you" },
    full: { ko: "선 안쪽 매트가 단정해 보여요", en: "Matte inside the line looks polished" },
  },
};

export function valueLabel<K extends ProfileKey>(key: K, value: FaceProfile[K], lang: Lang): string {
  return (VALUE_LABEL[key] as Record<string, Text>)[value as string][lang];
}

export function profileSummary(p: FaceProfile, lang: Lang): string {
  return (["eyelid", "eyeShape", "lipShape", "faceShape", "eyebrowShape"] as ProfileKey[])
    .map((k) => valueLabel(k, p[k], lang))
    .join(" · ");
}

/** Raw Face Analyzer caption: left/right labels collapse when identical ("Single-lid / Single-lid" → "Single-lid"). */
/** Plain-language name for a demo face by its eyelid type ("Monolid face" instead of a bare model id). */
export const FACE_NAME: Record<FaceProfile["eyelid"], Text> = {
  monolid: { ko: "홑꺼풀 얼굴", en: "Monolid face" },
  double: { ko: "쌍꺼풀 얼굴", en: "Double-lid face" },
  inner_double: { ko: "속쌍꺼풀 얼굴", en: "Inner-double-lid face" },
  hooded: { ko: "덮이는 눈꺼풀 얼굴", en: "Hooded-lid face" },
};

export function sourceCaption(raw: string): string {
  // A source already wrapped in parentheses (the "(not recorded)" placeholder) must not get a second pair from the caller.
  return Array.from(new Set(raw.split("/").map((s) => s.trim().replace(/^\(([^()]*)\)$/, "$1").trim()).filter(Boolean))).join(" / ");
}
