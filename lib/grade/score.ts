import { deltaE2000, labToHex, type Lab } from "../color";
import type { Text } from "../rules/engine";
import type { GradeRegion } from "../regions";
import type { RegionGrade } from "./types";

/** Client-safe scoring core (no sharp): the server graders and the /grade sample "try another shade" row share these functions. */

export function scoreFromDeltaE(dE: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - dE * 4)));
}

type TipKind = "good" | "more" | "less" | "hue";

const TIPS: Record<GradeRegion, Record<TipKind, Text>> = {
  eye_line: {
    good: { ko: "라인이 정답과 거의 같아요", en: "Your liner matches the answer" },
    more: { ko: "라인을 조금 더 진하게 — 눈 뜬 상태에서 보이게", en: "Make the liner a bit stronger — visible with eyes open" },
    less: { ko: "라인이 두꺼워요 — 꼬리는 가로로 2~3mm만", en: "Liner is heavy — keep the tail 2–3 mm, straight out" },
    hue: { ko: "라인 색이 달라요 — 브라운 계열로", en: "Liner color differs — try a brown shade" },
  },
  eye_lid: {
    good: { ko: "좋아요, 바깥쪽을 조금 더 흐리게", en: "Nice — blur the outer edge a little more" },
    more: { ko: "섀도를 한 번 더 — 가로로 넓게 펴요", en: "One more layer — spread it sideways" },
    less: { ko: "섀도가 진해요 — 브러시로 경계를 풀어요", en: "Shadow is strong — soften the edge with a brush" },
    hue: { ko: "섀도 톤이 달라요 — 정답 스와치를 확인해요", en: "Shadow tone differs — check the answer swatch" },
  },
  cheek: {
    good: { ko: "볼 위치와 양이 좋아요", en: "Blush placement and amount look right" },
    more: { ko: "블러셔를 광대 위로 손가락 한 마디 더", en: "Add blush one finger-width higher on the cheekbone" },
    less: { ko: "블러셔가 진해요 — 남은 양으로 톡톡", en: "Blush is strong — tap with what's left on the brush" },
    hue: { ko: "블러셔 색이 달라요 — 립과 같은 계열로", en: "Blush color differs — match it to your lip family" },
  },
  lip: {
    good: { ko: "그라데이션 경계가 자연스러워요", en: "The gradient edge looks natural" },
    more: { ko: "안쪽을 한 번 더 톡톡 — 중앙을 진하게", en: "Dab the center once more for depth" },
    less: { ko: "립이 진해요 — 바깥은 손가락으로 흐리게", en: "Lips are strong — blur the outside with a finger" },
    hue: { ko: "립 색이 달라요 — 정답 색과 비교해 봐요", en: "Lip color differs — compare with the answer" },
  },
};

/** Score + rule tip for one region from the answer/attempt mean colors (shared by box and landmark measures). */
export function regionGrade(region: GradeRegion, la: Lab, lb: Lab): RegionGrade {
  const dE = deltaE2000(la, lb);
  const score = scoreFromDeltaE(dE);
  let kind: TipKind = "good";
  // attempt lighter than the answer → not enough product ("more"); darker → too much ("less")
  if (score < 80) kind = lb[0] > la[0] + 3 ? "more" : lb[0] < la[0] - 3 ? "less" : "hue";
  return { region, score, tip: TIPS[region][kind], deltaE: Math.round(dE * 10) / 10, answerHex: labToHex(la), attemptHex: labToHex(lb) };
}


/** Overall score = rounded mean of the region scores. */
export function totalScore(regions: readonly { score: number }[]): number {
  return Math.round(regions.reduce((s, r) => s + r.score, 0) / regions.length);
}
