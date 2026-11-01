import table from "./techniques.json";
import type { FaceProfile, ProfileKey } from "../profile";

export type Lang = "ko" | "en";
export type Text = { ko: string; en: string };

interface PatternTech {
  pattern?: string;
  intensityDelta?: number;
}

export interface Reason {
  /** Which profile attribute triggered this branch (shown as the "왜 당신은" chip). */
  attr: ProfileKey;
  label: Text;
  why: Text;
  /** Plain-words basis for the rule, labelled as a rule of thumb (only some branches have one). */
  basis?: Text;
}

export interface ResolvedTechniques {
  eye: { shadow: Required<PatternTech>; liner: Required<PatternTech>; reasons: Reason[] };
  lip: {
    style: { type: string; innerColorRatio?: number; blendStrength?: number };
    texture: string;
    textureParams: Record<string, number>;
    morphology?: { fullness?: number; wrinkless?: number };
    intensityDelta: number;
    reasons: Reason[];
  };
  cheek: { pattern: string; reasons: Reason[] };
  contour: { pattern: string; reasons: Reason[] };
  brow: { pattern: string; reasons: Reason[] };
}

type Table = typeof table;
const T = table as Table;

function req(t: PatternTech | undefined, what: string): Required<PatternTech> {
  if (!t?.pattern) throw new Error(`rule table missing pattern for ${what}`);
  return { pattern: t.pattern, intensityDelta: t.intensityDelta ?? 0 };
}

/** F3: branch the lesson technique on the 5 face attributes. Pure lookup, 0 units. */
export function resolveTechniques(p: FaceProfile): ResolvedTechniques {
  const eye = T.eye[p.eyelid];
  const shape = T.eyeShape[p.eyeShape] as Table["eyeShape"]["almond"] & { liner?: PatternTech };
  const liner = req(eye.liner, `eye.${p.eyelid}.liner`);
  if (shape.liner?.pattern) liner.pattern = shape.liner.pattern;
  if (shape.liner?.intensityDelta) liner.intensityDelta += shape.liner.intensityDelta;

  const lip = T.lip[p.lipShape] as Table["lip"]["thin"] & { morphology?: { fullness?: number } };
  const cheek = T.cheek[p.faceShape];
  const contour = T.contour[p.faceShape];
  const brow = T.brow[p.eyebrowShape];

  return {
    eye: {
      shadow: req(eye.shadow, `eye.${p.eyelid}.shadow`),
      liner,
      reasons: [
        { attr: "eyelid", label: eye.label, why: eye.why, ...("basis" in eye ? { basis: eye.basis as Text } : {}) },
        ...(p.eyeShape !== "almond" ? [{ attr: "eyeShape" as const, label: shape.label, why: shape.why }] : []),
      ],
    },
    lip: {
      style: lip.style,
      texture: lip.texture,
      textureParams: lip.textureParams as Record<string, number>,
      morphology: lip.morphology,
      intensityDelta: lip.intensityDelta,
      reasons: [{ attr: "lipShape", label: lip.label, why: lip.why }],
    },
    cheek: { pattern: cheek.pattern, reasons: [{ attr: "faceShape", label: cheek.label, why: cheek.why }] },
    contour: { pattern: contour.pattern, reasons: [{ attr: "faceShape", label: contour.label, why: contour.why }] },
    brow: { pattern: brow.pattern, reasons: [{ attr: "eyebrowShape", label: brow.label, why: brow.why }] },
  };
}

export interface RuleRow {
  attr: ProfileKey;
  value: string;
  technique: string;
  pattern: string;
}

/** The eyelid → technique table rendered on screen (risk #34: show the rule table, not a "stylist wrapper"). */
export function eyelidRuleRows(lang: Lang): RuleRow[] {
  return (Object.keys(T.eye) as Array<keyof Table["eye"]>).map((k) => ({
    attr: "eyelid",
    value: k,
    technique: T.eye[k].label[lang],
    pattern: `${T.eye[k].shadow.pattern} · ${T.eye[k].liner.pattern}`,
  }));
}

export const RULE_TABLE_STATUS = T.status;
