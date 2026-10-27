/**
 * YouCam unit pricing used by the unit guard (F8) and the UI cost labels.
 *
 * Source: docs/plan.md unit table, cross-checked against the official API references
 * (docs.perfectcorp.com/reference/ai_face_analyzer "1–5 features = 10 units",
 * docs.perfectcorp.com/reference/makeup_vto "AI Makeup Virtual Try-On V1.0 = 1").
 * The live `GET /s2s/v2.0/credit/feature-cost` response is checked by spike #3.
 * Units are charged only when a task ends in `success`.
 */

/** Face Analyzer tier: 1–5 features → 10u, 6–14 → 20u, 15–28 → 30u. */
export function faceAnalyzerCost(featureCount: number): number {
  if (!Number.isInteger(featureCount) || featureCount < 1 || featureCount > 28) {
    throw new RangeError(`Face Analyzer accepts 1–28 features, got ${featureCount}`);
  }
  if (featureCount <= 5) return 10;
  if (featureCount <= 14) return 20;
  return 30;
}

/** Makeup VTO V1.0: one task (any number of effects) = 1 unit. */
export const MAKEUP_VTO_COST = 1;

/** The 5 attributes Mirror Tutor asks for (eyelid · eyeShape · lipShape · faceShape · eyebrowShape). */
export const FACE_FEATURE_COUNT = 5;

export const ANALYZE_COST = faceAnalyzerCost(FACE_FEATURE_COUNT); // 10

/** Rendering a lesson = one cumulative VTO task per step. */
export function lessonRenderCost(stepCount: number): number {
  if (!Number.isInteger(stepCount) || stepCount < 0) throw new RangeError(`bad step count ${stepCount}`);
  return stepCount * MAKEUP_VTO_COST;
}

/** Flow A: analyze once + render a 4-step lesson = 14u (plan: "풀 플로우 14u"). */
export function fullFlowCost(stepCount = 4): number {
  return ANALYZE_COST + lessonRenderCost(stepCount);
}

/** Flow B (returning user, profile cached locally): VTO only. */
export function revisitFlowCost(stepCount = 4): number {
  return lessonRenderCost(stepCount);
}
