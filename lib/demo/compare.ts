import { buildLesson } from "../lessons";
import { resolveTechniques, type Lang } from "../rules/engine";
import { valueLabel } from "../labels";
import type { FaceProfile, ProfileKey } from "../profile";

/** public/demo/compare.json — written once by scripts/demo/generate.ts, played back at 0u. */
export interface CompareModel {
  id: string;
  profile: FaceProfile;
  /** Raw Face Analyzer labels (e.g. "Double-lid / Double-lid"). */
  source: Record<ProfileKey, string>;
  original: string;
  steps: string[];
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
  /** VTO pattern names per model. */
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

function techniqueFor(attr: ProfileKey, p: FaceProfile, lang: Lang): { technique: string; pattern: string } {
  const t = resolveTechniques(p);
  switch (attr) {
    case "eyelid":
    case "eyeShape": {
      const r = t.eye.reasons.find((x) => x.attr === attr) ?? t.eye.reasons[0];
      return { technique: r.label[lang], pattern: attr === "eyelid" ? `${t.eye.shadow.pattern} · ${t.eye.liner.pattern}` : t.eye.liner.pattern };
    }
    case "lipShape":
      return { technique: t.lip.reasons[0].label[lang], pattern: `${t.lip.style.type} · ${t.lip.texture}` };
    case "faceShape":
      return { technique: `${t.cheek.reasons[0].label[lang]} / ${t.contour.reasons[0].label[lang]}`, pattern: `${t.cheek.pattern} · ${t.contour.pattern}` };
    case "eyebrowShape":
      return { technique: t.brow.reasons[0].label[lang], pattern: t.brow.pattern };
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

/** True when the two demo faces land on the same eyelid branch (then the eyelid contrast can't be shown). */
export function sameEyelid(m: CompareManifest): boolean {
  return m.models.length >= 2 && m.models[0].profile.eyelid === m.models[1].profile.eyelid;
}
