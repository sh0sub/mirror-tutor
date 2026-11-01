import manifestJson from "../../public/demo/compare.json";
import type { CompareManifest, CompareModel } from "./compare";

/**
 * "샘플 모델로 체험하기 · 0 유닛" (client-safe constants). The sample model (double-lid face) of the two-face demo: a Pexels stock photo whose
 * Face Analyzer profile and 4 daily-k Makeup VTO steps were generated once offline (scripts/demo/generate.ts).
 */
const manifest = manifestJson as CompareManifest;
export const SAMPLE_MODEL: CompareModel = manifest.models[0];
export const SAMPLE_LESSON = manifest.lessonId;
/**
 * Stand-in "my attempt" for grading: a SIMULATED attempt, the lesson answer (step 4) with a deterministic, deliberately off-shade CIELAB
 * shift inside each graded region (liner too faint, shadow a little deep, base a touch light, lips lighter and more orange).
 * Made offline at 0 units by scripts/demo/make-sample-attempt.ts; the grade screen labels it as simulated.
 */
export const SAMPLE_ATTEMPT = "/demo/model-a/sample-attempt.jpg";
/**
 * The grade of SAMPLE_ATTEMPT (eyeliner 77, eyelid 85, cheeks 93, lips 62 → 79; read from the app grade screen in headless Chrome, C9) against the lesson answer (deterministic: real CIELAB/landmark scoring of the two photos).
 * The demo video (record-video.mjs `full91`, recomposite.mjs notes) and docs quote this one number on the grade, share and home scenes.
 */
export const SAMPLE_SCORE = 79;
