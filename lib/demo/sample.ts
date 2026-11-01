import manifestJson from "../../public/demo/compare.json";
import type { CompareManifest, CompareModel } from "./compare";

/**
 * "샘플 모델로 체험하기 · 0 유닛" (client-safe constants). The sample model (double-lid face) of the two-face demo: a Pexels stock photo whose
 * Face Analyzer profile and 4 daily-k Makeup VTO steps were generated once offline (scripts/demo/generate.ts).
 */
const manifest = manifestJson as CompareManifest;
export const SAMPLE_MODEL: CompareModel = manifest.models[0];
export const SAMPLE_LESSON = manifest.lessonId;
/** Stand-in "my attempt" for grading: eyes done, lips skipped → the grade shows a real correction (same as the demo video). */
export const SAMPLE_ATTEMPT = SAMPLE_MODEL.steps[2];
