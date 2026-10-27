import { sanitizeImage, ImageRejectedError } from "../privacy/sanitize";
import { GRADE_WIDTH, gradeLocal, measure, regionCrops } from "../grade/local";
import { anthropicCreate, gradeWithClaude, type CreateMessage } from "../grade/claude";
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
export async function gradeAttempt(answer: Uint8Array, attempt: Uint8Array, deps: GradeDeps = {}): Promise<GradeResult | { error: string }> {
  let a: Uint8Array;
  let b: Uint8Array;
  try {
    a = (await sanitizeImage(answer)).bytes;
    b = (await sanitizeImage(attempt)).bytes;
  } catch (e) {
    return { error: e instanceof ImageRejectedError ? e.code : "undecodable" };
  }
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
