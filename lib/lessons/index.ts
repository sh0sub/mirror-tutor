import dailyK from "./daily-k.json";
import shading from "./shading.json";
import gradientLip from "./gradient-lip.json";
import { resolveTechniques, type Lang, type Reason, type ResolvedTechniques, type Text } from "../rules/engine";
import type { Effect, Palette } from "../youcam/makeupVto";
import type { FaceProfile } from "../profile";
import type { RegionId } from "../regions";

type Slot = "brow" | "eye.shadow" | "eye.liner" | "cheek" | "contour" | "lip";

interface EffectTemplate extends Effect {
  slot?: Slot;
  forceOmbre?: boolean;
}

interface LessonStepDef {
  id: string;
  title: Text;
  region: string;
  instruction: Text;
  effects: EffectTemplate[];
}

export interface LessonDef {
  id: string;
  title: Text;
  summary: Text;
  minutes: number;
  steps: LessonStepDef[];
}

export const LESSONS: LessonDef[] = [dailyK, shading, gradientLip] as LessonDef[];
export type LessonId = "daily-k" | "shading" | "gradient-lip";

export function getLesson(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id);
}

export interface PlannedStep {
  index: number; // 1-based
  id: string;
  title: Text;
  instruction: Text;
  region: RegionId;
  /** Techniques that shaped this step ("왜 당신은 이렇게" chips). */
  reasons: Reason[];
  /** Effects added in this step. */
  effects: Effect[];
  /** effects[1..k] — what one VTO call renders for step k (plan: "단계 k = effects[1..k] 누적 1호출"). */
  cumulativeEffects: Effect[];
  /** Hex colors used in this step (= product shades for Shop the step). */
  colors: Array<{ hex: string; category: string; texture?: string }>;
}

export interface LessonPlan {
  id: string;
  title: Text;
  summary: Text;
  minutes: number;
  steps: PlannedStep[];
}

/** Neutral geometry: keep the user's own curve/thickness, moderate edge definition. */
export const BROW_SHAPE_DEFAULTS = { curvature: 0, thickness: 0, definition: 50 } as const;

/** Ombre outer palette = inner shade at this fraction of its intensity. */
export const OMBRE_OUTER_RATIO = 0.4;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function scalePalette(p: Palette, delta: number, scale: number): Palette {
  return { ...p, colorIntensity: clamp(((p.colorIntensity ?? 50) + delta) * scale) };
}

function applySlot(t: EffectTemplate, tech: ResolvedTechniques, scale: number): { effect: Effect; reasons: Reason[] } {
  const { slot, forceOmbre, ...rest } = t;
  const e: Effect = { ...rest, palettes: rest.palettes?.map((p) => ({ ...p })) };
  const pal = (delta: number) => (e.palettes = e.palettes?.map((p) => scalePalette(p, delta, scale)));

  switch (slot) {
    case "brow":
      // Live API (2026-10-27) rejects shape patterns without curvature/thickness/definition
      // (invalid_parameter "effects.eyebrows.pattern.curvature is required" …) although the OpenAPI marks them optional.
      e.pattern = { type: "shape", name: tech.brow.pattern, ...BROW_SHAPE_DEFAULTS };
      pal(0);
      return { effect: e, reasons: tech.brow.reasons };
    case "eye.shadow":
      e.pattern = { name: tech.eye.shadow.pattern };
      pal(tech.eye.shadow.intensityDelta);
      return { effect: e, reasons: tech.eye.reasons };
    case "eye.liner":
      e.pattern = { name: tech.eye.liner.pattern };
      pal(tech.eye.liner.intensityDelta);
      return { effect: e, reasons: [] }; // reasons already attached via eye.shadow
    case "cheek":
      e.pattern = { name: tech.cheek.pattern };
      pal(0);
      return { effect: e, reasons: tech.cheek.reasons };
    case "contour":
      e.pattern = { name: tech.contour.pattern };
      pal(0);
      return { effect: e, reasons: tech.contour.reasons };
    case "lip": {
      const l = tech.lip;
      e.shape = { name: "original" };
      e.style = forceOmbre && l.style.type !== "ombre" ? { type: "ombre", innerColorRatio: 55, blendStrength: 55 } : { ...l.style };
      if (l.morphology) e.morphology = { ...l.morphology };
      e.palettes = e.palettes?.map((p) => ({ ...scalePalette(p, l.intensityDelta, scale), texture: l.texture, ...l.textureParams }));
      // Live API rejects ombre with one palette ("effects.lip_color.palettes length is insufficient").
      // palettes[0] = outer (same shade, sheer edge), palettes[1] = inner/secondary color that innerColorRatio extends.
      // (미확인: 바깥/안쪽 순서는 결과 이미지로 눈 확인 필요)
      if (e.style.type === "ombre" && e.palettes?.length === 1) {
        const inner = e.palettes[0];
        e.palettes = [{ ...inner, colorIntensity: clamp((inner.colorIntensity ?? 50) * OMBRE_OUTER_RATIO) }, inner];
      }
      return { effect: e, reasons: l.reasons };
    }
    default:
      if (e.category === "skin_smooth") return { effect: e, reasons: [] };
      pal(0);
      return { effect: e, reasons: [] };
  }
}

export interface BuildOptions {
  /** S4 hook: 0.8 / 1.2 intensity. MVP always 1. */
  intensityScale?: number;
}

/** F4: lesson definition + face profile → per-step VTO effects (cumulative) and reasons. 0 units. */
export function buildLesson(lessonId: string, profile: FaceProfile, opts: BuildOptions = {}): LessonPlan {
  const def = getLesson(lessonId);
  if (!def) throw new Error(`unknown lesson ${lessonId}`);
  const tech = resolveTechniques(profile);
  const scale = opts.intensityScale ?? 1;
  const cumulative: Effect[] = [];
  const steps = def.steps.map((s, i) => {
    const applied = s.effects.map((t) => applySlot(t, tech, scale));
    const effects = applied.map((a) => a.effect);
    cumulative.push(...effects);
    return {
      index: i + 1,
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      region: s.region as RegionId,
      reasons: applied.flatMap((a) => a.reasons),
      effects,
      cumulativeEffects: cumulative.map((e) => structuredClone(e)),
      colors: effects
        .flatMap((e) => (e.palettes ?? []).map((p) => ({ hex: p.color.toUpperCase(), category: e.category, texture: p.texture })))
        .filter((c, i, all) => all.findIndex((o) => o.hex === c.hex && o.category === c.category) === i),
    };
  });
  return { id: def.id, title: def.title, summary: def.summary, minutes: def.minutes, steps };
}

export interface Recommendation {
  lessonId: LessonId;
  reason: Text;
}

/** Plan flow A5: highlight one of the 3 lessons based on the profile. */
export function recommendLesson(p: FaceProfile): Recommendation {
  if (p.eyelid !== "double") {
    const eyelid: Record<string, Text> = {
      monolid: { ko: "홑꺼풀용 가로 그라데이션 버전", en: "Monolid version with a horizontal gradient" },
      inner_double: { ko: "속쌍꺼풀용 얇은 라인 버전", en: "Inner-double version with a thin liner" },
      hooded: { ko: "덮이는 눈꺼풀용 높게 놓는 섀도 버전", en: "Hooded-lid version with higher shadow" },
    };
    return { lessonId: "daily-k", reason: eyelid[p.eyelid] };
  }
  if (p.lipShape === "thin") return { lessonId: "gradient-lip", reason: { ko: "얇은 입술에 맞춘 안쪽 그라데이션", en: "Inside-out gradient for thin lips" } };
  if (["round", "square", "oblong", "diamond"].includes(p.faceShape)) {
    return { lessonId: "shading", reason: { ko: "얼굴형에 맞춘 음영 위치", en: "Contour placed for your face shape" } };
  }
  return { lessonId: "daily-k", reason: { ko: "쌍꺼풀 주름을 살린 기본 룩", en: "Everyday look that uses your crease" } };
}

export function lessonTitle(id: string, lang: Lang): string {
  return getLesson(id)?.title[lang] ?? id;
}
