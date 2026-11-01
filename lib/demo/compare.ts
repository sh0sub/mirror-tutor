import { buildLesson } from "../lessons";
import { eyelidRuleRows, resolveTechniques, type Lang, type RuleRow } from "../rules/engine";
import { valueLabel } from "../labels";
import type { FaceProfile, ProfileKey } from "../profile";

/** public/demo/compare.json — written once by scripts/demo/generate.ts, played back at 0u. */
export interface CompareModel {
  id: string;
  profile: FaceProfile;
  /** Raw Face Analyzer labels (e.g. "Double-lid / Double-lid"). */
  source: Record<ProfileKey, string>;
  /** Fields corrected on M2 after the analyzer misread them (source keeps the raw reading). */
  edited?: ProfileKey[];
  /** C11: the profile exactly as Face Analyzer read it, when it differs from `profile` (only for `edited` models). */
  rawProfile?: FaceProfile;
  original: string;
  steps: string[];
  /** C11: the lesson's 4 Makeup VTO steps on `rawProfile` (the uncorrected reading), used by the monolid sample trial. */
  rawSteps?: string[];
  /** C7: the same eye step with two shadow patterns (horizontal = this app's monolid rule, vertical = generic tutorial technique), same face, same colors. */
  gradientPair?: { horizontal: string; vertical: string; shadowIntensity: number };
  credit: string;
}

export interface CompareManifest {
  lessonId: string;
  generatedAt: string;
  models: CompareModel[];
}

export interface TechniqueRow {
  attr: ProfileKey;
  /** Attribute value per model (localized). */
  values: [string, string];
  /** Technique label per model (localized, from the rule table). */
  techniques: [string, string];
  /** VTO pattern per model as plain KO/EN words (no raw API tokens). */
  patterns: [string, string];
  same: boolean;
}

/** Which rule-table branches a lesson step depends on. */
function stepAttrs(lessonId: string, profile: FaceProfile, step: number): ProfileKey[] {
  const s = buildLesson(lessonId, profile).steps[step - 1];
  const fromReasons = s.reasons.map((r) => r.attr);
  if (s.region === "eye_lid" && !fromReasons.includes("eyelid")) fromReasons.push("eyelid");
  return Array.from(new Set(fromReasons));
}

type PatternKind = "shadow" | "liner" | "cheek" | "contour" | "brow";

const T2 = (ko: string, en: string) => ({ ko, en });
/** Words in VTO pattern names (lib/catalog/patterns.json labels such as "Upper6", "OvalFace10") → plain labels. */
const PATTERN_WORD: Record<string, { ko: string; en: string }> = {
  Upper: T2("윗라인", "upper liner"),
  OpenWings: T2("꼬리 길게 뺀 라인", "open-wings liner"),
  Circle: T2("동그란 블러셔", "round blush"),
  Oblique: T2("사선 블러셔", "diagonal blush"),
  Oblong: T2("긴 얼굴용 블러셔", "oblong-face blush"),
  Round: T2("둥근 블러셔", "round-face blush"),
  Heart: T2("하트형 블러셔", "heart-face blush"),
  Triangle: T2("삼각형 블러셔", "triangle-face blush"),
  OvalFace: T2("달걀형 음영", "oval-face contour"),
  RoundFace: T2("둥근형 음영", "round-face contour"),
  HeartFace: T2("하트형 음영", "heart-face contour"),
  TriangleFace: T2("삼각형 음영", "triangle-face contour"),
  Invtriangle: T2("역삼각형 음영", "inverted-triangle contour"),
  Straight: T2("일자 눈썹", "straight brow"),
  SoftArch: T2("부드러운 아치 눈썹", "soft-arch brow"),
  Curved: T2("곡선 눈썹", "curved brow"),
  Original: T2("원래 눈썹 모양", "original brow shape"),
};
const KIND_WORD: Record<PatternKind, Record<"ko" | "en", string>> = {
  shadow: T2("섀도", "shadow"),
  liner: T2("라인", "liner"),
  cheek: T2("블러셔", "blush"),
  contour: T2("음영", "contour"),
  brow: T2("눈썹", "brow"),
};

/**
 * Human label for a VTO pattern name (so /compare never shows raw API tokens like "2colors1 · Upper6").
 * "2colors1" → "2-color shadow, style 1"; "Upper6" → "upper liner, style 6". Unknown names fall back to the raw name.
 */
export function patternLabel(kind: PatternKind, name: string, lang: Lang): string {
  const m = /^(\d?[A-Za-z]+?)(\d+)$/.exec(name);
  if (!m) return name;
  const [, word, n] = m;
  const style = lang === "ko" ? `${n}번 스타일` : `style ${n}`;
  const colors = /^(\d)colors?$/.exec(word);
  if (kind === "shadow" && colors) return lang === "ko" ? `${colors[1]}색 ${KIND_WORD.shadow.ko}, ${style}` : `${colors[1]}-color ${KIND_WORD.shadow.en}, ${style}`;
  const w = PATTERN_WORD[word];
  return w ? `${w[lang]}, ${style}` : name;
}

/** /analyze rule table: eyelid rows with plain-word patterns (never raw tokens like "2colors1 · Upper6"). */
export function eyelidRuleRowsLabeled(lang: Lang): RuleRow[] {
  return eyelidRuleRows(lang).map((r) => ({ ...r, pattern: `${patternLabel("shadow", r.shadowPattern, lang)} · ${patternLabel("liner", r.linerPattern, lang)}` }));
}

const LIP_STYLE: Record<string, { ko: string; en: string }> = { ombre: T2("그라데이션", "ombre"), full: T2("꽉 채움", "full coverage") };
const LIP_TEXTURE: Record<string, { ko: string; en: string }> = { gloss: T2("글로스", "gloss"), satin: T2("새틴", "satin"), matte: T2("매트", "matte") };

function techniqueFor(attr: ProfileKey, p: FaceProfile, lang: Lang): { technique: string; pattern: string } {
  const t = resolveTechniques(p);
  switch (attr) {
    case "eyelid":
    case "eyeShape": {
      const r = t.eye.reasons.find((x) => x.attr === attr) ?? t.eye.reasons[0];
      return { technique: r.label[lang], pattern: attr === "eyelid" ? `${patternLabel("shadow", t.eye.shadow.pattern, lang)} · ${patternLabel("liner", t.eye.liner.pattern, lang)}` : patternLabel("liner", t.eye.liner.pattern, lang) };
    }
    case "lipShape":
      return { technique: t.lip.reasons[0].label[lang], pattern: `${LIP_STYLE[t.lip.style.type]?.[lang] ?? t.lip.style.type} · ${LIP_TEXTURE[t.lip.texture]?.[lang] ?? t.lip.texture}` };
    case "faceShape":
      return { technique: `${t.cheek.reasons[0].label[lang]} / ${t.contour.reasons[0].label[lang]}`, pattern: `${patternLabel("cheek", t.cheek.pattern, lang)} · ${patternLabel("contour", t.contour.pattern, lang)}` };
    case "eyebrowShape":
      return { technique: t.brow.reasons[0].label[lang], pattern: patternLabel("brow", t.brow.pattern, lang) };
  }
}

/** S2: same lesson step, two faces → the rule-table branch each face took (risk #34: show the rules). */
export function compareStep(lessonId: string, a: FaceProfile, b: FaceProfile, step: number, lang: Lang): TechniqueRow[] {
  const attrs = Array.from(new Set([...stepAttrs(lessonId, a, step), ...stepAttrs(lessonId, b, step)]));
  return attrs.map((attr) => {
    const ta = techniqueFor(attr, a, lang);
    const tb = techniqueFor(attr, b, lang);
    return {
      attr,
      values: [valueLabel(attr, a[attr], lang), valueLabel(attr, b[attr], lang)],
      techniques: [ta.technique, tb.technique],
      patterns: [ta.pattern, tb.pattern],
      same: ta.pattern === tb.pattern && ta.technique === tb.technique,
    };
  });
}

/**
 * The two faces /compare shows: the monolid face vs the double-lid face (the product's core contrast).
 * Falls back to the first two models when the manifest has no such pair.
 */
export function comparePair(m: CompareManifest): [CompareModel, CompareModel] {
  const mono = m.models.find((x) => x.profile.eyelid === "monolid");
  const dbl = m.models.find((x) => x.profile.eyelid === "double");
  return mono && dbl ? [mono, dbl] : [m.models[0], m.models[1]];
}

/** True when the two shown faces land on the same eyelid branch (then the eyelid contrast can't be shown). */
export function sameEyelid(m: CompareManifest): boolean {
  if (m.models.length < 2) return false;
  const [a, b] = comparePair(m);
  return a.profile.eyelid === b.profile.eyelid;
}

/** First lesson step where the two profiles take different eyelid techniques (the step /compare opens on). */
export function eyelidStep(lessonId: string, a: FaceProfile, b: FaceProfile): number | undefined {
  const n = buildLesson(lessonId, a).steps.length;
  for (let k = 1; k <= n; k++) {
    if (compareStep(lessonId, a, b, k, "en").some((r) => r.attr === "eyelid" && !r.same)) return k;
  }
  return undefined;
}
