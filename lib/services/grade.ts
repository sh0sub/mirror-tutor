import { sanitizeImage, ImageRejectedError } from "../privacy/sanitize";
import { GRADE_WIDTH, gradeLocal, measure, measureWithLandmarks, regionCrops } from "../grade/local";
import { anthropicCreate, explainWithClaude, gradeWithClaude, type CreateMessage } from "../grade/claude";
import type { LandmarkMeasure } from "../grade/landmarks";
import type { GradeResult } from "../grade/types";
import { safeLog } from "../privacy/log";
import sharp from "sharp";

export interface GradeDeps {
  /** Claude call; undefined → deterministic local grader (no ANTHROPIC_API_KEY). */
  create?: CreateMessage;
  model?: string;
}

export function gradeDepsFromEnv(anthropicKey: string, model: string): GradeDeps {
  return anthropicKey ? { create: anthropicCreate(anthropicKey), model } : {};
}

/**
 * F6: answer (VTO final step) vs attempt (new selfie) → per-region 0–100 + one-line tip + confidence.
 * 0 YouCam units; re-grading is free. If Claude fails or refuses, the local ΔE grade is returned.
 */
export async function gradeAttempt(
  answer: Uint8Array,
  attempt: Uint8Array,
  deps: GradeDeps = {},
  landmarks: LandmarkMeasure | null = null,
): Promise<GradeResult | { error: string }> {
  let a: Uint8Array;
  let b: Uint8Array;
  try {
    a = (await sanitizeImage(answer)).bytes;
    b = (await sanitizeImage(attempt)).bytes;
  } catch (e) {
    return { error: e instanceof ImageRejectedError ? e.code : "undecodable" };
  }
  if (landmarks) return gradeWithLandmarks(a, b, landmarks, deps);
  if (!deps.create) return gradeLocal(a, b);

  const m = await measure(a, b);
  if (!m.comparable) return gradeLocal(a, b);
  try {
    const meta = await sharp(a).metadata();
    const h = Math.round((GRADE_WIDTH * (meta.height ?? 640)) / (meta.width ?? 480));
    const [answerCrops, attemptCrops] = await Promise.all([regionCrops(a, GRADE_WIDTH, h), regionCrops(b, GRADE_WIDTH, h)]);
    return await gradeWithClaude({ answerCrops, attemptCrops, measure: m }, deps.create, deps.model ?? "claude-opus-5-5");
  } catch (e) {
    safeLog("warn", "claude grader failed, using local grade", e);
    return gradeLocal(a, b);
  }
}

/**
 * S1: scores come from the browser's landmark-polygon Lab means (ΔE recomputed here). Claude, when
 * configured, only rewrites the tips from those numbers (text-only call); any failure keeps the rule tips.
 */
async function gradeWithLandmarks(a: Uint8Array, b: Uint8Array, lm: LandmarkMeasure, deps: GradeDeps): Promise<GradeResult> {
  const m = await measureWithLandmarks(a, b, lm);
  let regions = m.regions;
  let explainer: "claude" | "rules" = "rules";
  if (deps.create) {
    try {
      const labs = new Map(lm.regions.map((r) => [r.region, r]));
      const tips = await explainWithClaude(
        regions.map((r) => ({ region: r.region, score: r.score, deltaE: r.deltaE, answerLab: labs.get(r.region)!.answerLab, attemptLab: labs.get(r.region)!.attemptLab })),
        deps.create,
        deps.model ?? "claude-opus-5-5",
      );
      regions = regions.map((r) => ({ ...r, tip: tips.get(r.region) ?? r.tip }));
      explainer = "claude";
    } catch (e) {
      safeLog("warn", "claude explainer failed, using rule tips", e);
    }
  }
  return {
    comparable: true,
    total: Math.round(regions.reduce((s, r) => s + r.score, 0) / regions.length),
    confidence: m.confidence,
    confidenceReason: m.confidenceReason,
    regions,
    grader: "landmark",
    explainer,
    units: 0,
  };
}
