import type { GradeRegion } from "../regions";
import type { Text } from "../rules/engine";

export type Confidence = "high" | "medium" | "low";

export interface RegionGrade {
  region: GradeRegion;
  score: number; // 0–100
  tip: Text;
  /** Measured CIEDE2000 between answer and attempt crops (numeric evidence shown with the score). */
  deltaE: number;
}

export interface GradeResult {
  /** false = "각도가 많이 달라요 — 다시 찍기": no numbers are invented (plan M4 state ④). */
  comparable: boolean;
  total: number | null;
  confidence: Confidence;
  confidenceReason: Text | null;
  regions: RegionGrade[];
  grader: "local" | "claude";
  /** Grading never spends YouCam units (re-grading is free). */
  units: 0;
}

export const REGION_NAME: Record<GradeRegion, Text> = {
  eye_line: { ko: "눈 라인", en: "Eyeliner" },
  eye_lid: { ko: "눈두덩", en: "Eyelid" },
  cheek: { ko: "볼", en: "Cheeks" },
  lip: { ko: "립", en: "Lips" },
};

export function scoreBand(total: number): Text {
  if (total >= 85) return { ko: "아주 좋아요", en: "Great job" };
  if (total >= 70) return { ko: "거의 다 왔어요", en: "Almost there" };
  if (total >= 50) return { ko: "조금만 더 해 봐요", en: "A little more" };
  return { ko: "한 번 더 해 볼까요", en: "Let's try once more" };
}
