import manifestJson from "../../public/demo/compare.json";
import gradesJson from "../../public/demo/sample-grades.json";
import type { CompareManifest, CompareModel } from "./compare";
import type { GradeResult } from "../grade/types";
import type { GradePins } from "../facePins";
import type { FaceProfile } from "../profile";
import { recommendLesson, type Recommendation } from "../lessons";

/**
 * "샘플 모델로 체험하기 · 0 유닛" (client-safe constants). Two sample faces of the two-face demo, both stock photos whose Face Analyzer
 * profile and daily-k Makeup VTO steps were generated once offline (scripts/demo/generate.ts):
 *  - model-a, a double-lid face (the default trial),
 *  - model-c, a monolid face that Face Analyzer read as Double-lid. The trial walks the correction: the analyzer's raw reading
 *    (rawProfile) plays the raw lesson (rawSteps, generate-raw.ts), and the visitor's own edit to Monolid switches to the corrected one (steps).
 */
const manifest = manifestJson as CompareManifest;
export type SampleId = "model-a" | "model-c";
export const SAMPLE_IDS: readonly SampleId[] = ["model-a", "model-c"];
export const DEFAULT_SAMPLE: SampleId = "model-a";
export const isSampleId = (v: unknown): v is SampleId => typeof v === "string" && (SAMPLE_IDS as readonly string[]).includes(v);

export const sampleModelById = (id: SampleId): CompareModel => manifest.models.find((m) => m.id === id)!;
export const SAMPLE_MODEL: CompareModel = sampleModelById(DEFAULT_SAMPLE);
export const SAMPLE_LESSON = manifest.lessonId;
/** The profile the analyzer returns for a sample (the raw reading when the sample is a misread one). */
export const analyzedProfile = (id: SampleId): FaceProfile => sampleModelById(id).rawProfile ?? sampleModelById(id).profile;

/**
 * Stand-in "my attempt" for grading: a SIMULATED attempt, the lesson answer (step 4) with a deterministic, deliberately off-shade CIELAB
 * shift inside each graded region (liner too faint, shadow a little deep, base a touch light, lips lighter and more orange).
 * Made offline at 0 units by scripts/demo/make-sample-attempt.ts; the grade screen labels it as simulated.
 */
export const SAMPLE_ATTEMPT = "/demo/model-a/sample-attempt.jpg";
/** Simulated attempt per sample and answer image (model-c has one per lesson variant: raw and corrected). Key = the answer image path. */
export const SAMPLE_ATTEMPTS: Record<string, string> = {
  [sampleModelById("model-a").steps[3]]: SAMPLE_ATTEMPT,
  [sampleModelById("model-c").steps[3]]: "/demo/model-c/sample-attempt.jpg",
  [sampleModelById("model-c").rawSteps?.[3] ?? "/demo/model-c/raw-step-4.jpg"]: "/demo/model-c/sample-attempt-raw.jpg",
};
/** Fallback attempt for a sample whose answer is not a pre-generated image: that sample's own face (never another person's photo). */
export const sampleOwnAttempt = (id: SampleId): string => (id === "model-c" ? "/demo/model-c/sample-attempt.jpg" : SAMPLE_ATTEMPT);
/** The attempt photo for an answer image, or null when the answer is not a pre-generated one (a ±20% preview, an edited profile). */
export const sampleAttemptFor = (answerImage: string | null): string | null => (answerImage ? (SAMPLE_ATTEMPTS[answerImage] ?? null) : null);

/**
 * The grade of SAMPLE_ATTEMPT (eyeliner 77, eyelid 85, cheeks 93, lips 62 → 79) against the lesson answer (deterministic: real CIELAB/landmark scoring of the two photos).
 * The demo video (record-video.mjs `full91`, recomposite.mjs notes) and docs quote this one number on the grade, share and home scenes.
 */
export const SAMPLE_SCORE = 79;

/** Offline-computed result (scripts/demo/make-sample-grades.ts, the same landmark ΔE grader as live grading, rule tips) per attempt photo, plus the score-label points on it. */
export interface SampleGrade {
  grade: GradeResult;
  pins: GradePins | null;
}
export const SAMPLE_GRADES = gradesJson as unknown as Record<string, SampleGrade>;

/**
 * Lesson recommendation inside the sample trial. The sample's renders were pre-generated for SAMPLE_LESSON only, so the sample
 * always recommends it (the monolid sample's raw Double-lid reading would otherwise point at a lesson with no pre-generated
 * images and the trial would fall back to a preview overlay and a different face). Edited profiles keep the rule-table pick.
 */
export function sampleRecommendation(profile: FaceProfile): Recommendation {
  const rec = recommendLesson(profile);
  if (rec.lessonId === SAMPLE_LESSON) return rec;
  return profile.eyelid === "double" ? { lessonId: SAMPLE_LESSON as Recommendation["lessonId"], reason: { ko: "쌍꺼풀 주름을 살린 기본 룩", en: "Everyday look that uses your crease" } } : rec;
}
