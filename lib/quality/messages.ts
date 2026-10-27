import type { Lang, Text } from "../rules/engine";
import type { QualityIssue } from "./gate";

/** Guide copy: tell the next action, never scold (design direction "따뜻한 코치"). */
export const ISSUE_MESSAGE: Record<QualityIssue, Text> = {
  no_face: { ko: "얼굴을 타원 안에 맞춰 주세요", en: "Fit your face inside the oval" },
  face_too_small: { ko: "조금 더 가까이 — 얼굴이 화면 폭의 60% 이상이어야 해요", en: "Come a little closer — your face should fill 60% of the width" },
  too_dark: { ko: "더 밝은 곳으로 — 창가가 좋아요", en: "Find more light — a window works well" },
  too_bright: { ko: "빛이 너무 강해요 — 정면 조명을 조금 피해 주세요", en: "Too much glare — step away from direct light" },
  not_frontal: { ko: "정면을 봐 주세요", en: "Look straight at the camera" },
};

export type GuideKey = QualityIssue | "angle_up" | "angle_down" | "turn" | "tilt" | "retry" | "credit";

const GUIDE: Record<Exclude<GuideKey, QualityIssue>, Text> = {
  angle_up: { ko: "고개를 살짝 내려 주세요", en: "Tilt your head down slightly" },
  angle_down: { ko: "고개를 살짝 들어 주세요", en: "Tilt your head up slightly" },
  turn: { ko: "얼굴을 정면으로 돌려 주세요", en: "Turn your face to the front" },
  tilt: { ko: "고개를 똑바로 세워 주세요", en: "Keep your head level" },
  retry: { ko: "잠시 후 다시 찍어 주세요", en: "Please try again in a moment" },
  credit: { ko: "지금은 체험 유닛이 부족해요 — 샘플 모델로 볼 수 있어요", en: "Out of trial units — you can try the sample model" },
};

/**
 * YouCam error code → guide key. Codes from the Face Analyzer and Makeup VTO references plus the
 * codes listed in the plan mockup spec (error_src_face_too_small, error_lighting_dark,
 * error_src_face_out_of_bound — not in the current docs, kept as aliases (미확인)).
 * Errors are not billed, so every mapping leads to a free retake.
 */
export const ERROR_CODE_GUIDE: Record<string, GuideKey> = {
  error_below_min_image_size: "face_too_small",
  error_face_position_too_small: "face_too_small",
  error_src_face_too_small: "face_too_small",
  error_face_position_invalid: "no_face",
  error_no_face: "no_face",
  error_face_position_out_of_boundary: "not_frontal",
  error_src_face_out_of_bound: "not_frontal",
  error_face_not_forward_facing: "turn",
  error_face_angle_invalid: "turn",
  error_face_angle_leftward: "turn",
  error_face_angle_rightward: "turn",
  error_face_angle_upward: "angle_up",
  error_face_angle_downward: "angle_down",
  error_face_angle_left_tilt: "tilt",
  error_face_angle_right_tilt: "tilt",
  error_lighting_dark: "too_dark",
  CreditInsufficiency: "credit",
};

export function guideForErrorCode(code: string | undefined): GuideKey {
  return (code && ERROR_CODE_GUIDE[code]) || "retry";
}

export function guideText(key: GuideKey, lang: Lang): string {
  return key in ISSUE_MESSAGE ? ISSUE_MESSAGE[key as QualityIssue][lang] : GUIDE[key as Exclude<GuideKey, QualityIssue>][lang];
}
