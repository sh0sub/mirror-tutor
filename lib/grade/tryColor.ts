import { hexToLab, labToHex, type Lab } from "../color";
import type { GradeRegion } from "../regions";
import type { Text } from "../rules/engine";
import { regionGrade, totalScore } from "./score";
import type { GradeResult } from "./types";

/**
 * /grade sample mode, "Try it: change the attempt color". The sample attempt photo is fixed, so each graded region offers a few shade
 * chips around the answer's own mean color; picking one re-runs regionGrade (the same CIEDE2000 + score + tip functions the live graders
 * use) on the answer's mean color vs the chosen shade and re-averages the total. Everything is computed in the browser, 0 units.
 */

export type ShadeId = "match" | "lighter" | "deeper" | "warmer" | "pinker";

export interface ShadeChip {
  id: ShadeId;
  label: Text;
  hex: string;
}

const SHADES: { id: ShadeId; label: Text; shift: Lab }[] = [
  { id: "match", label: { ko: "정답과 같은 색", en: "Same as answer" }, shift: [0, 0, 0] },
  { id: "lighter", label: { ko: "더 연하게", en: "Lighter" }, shift: [9, -1, -2] },
  { id: "deeper", label: { ko: "더 진하게", en: "Deeper" }, shift: [-9, 1, 2] },
  { id: "warmer", label: { ko: "더 따뜻하게", en: "Warmer" }, shift: [0, 5, 11] },
  { id: "pinker", label: { ko: "더 핑크 쪽", en: "Pinker" }, shift: [0, 9, -6] },
];

/** The shade chips for one region: the answer's mean color shifted in CIELAB. Deterministic. */
export function shadeChips(answerHex: string): ShadeChip[] {
  const [L, a, b] = hexToLab(answerHex);
  return SHADES.map((s) => ({ id: s.id, label: s.label, hex: labToHex([L + s.shift[0], a + s.shift[1], b + s.shift[2]]) }));
}

/** Per-region attempt colors the visitor picked (absent = the simulated attempt's own color). */
export type ShadePicks = Partial<Record<GradeRegion, string>>;

/** The grade with the picked shades swapped in: only picked regions are re-scored, the total is re-averaged. Returns `grade` itself when nothing is picked. */
export function regradeWithShades(grade: GradeResult, picks: ShadePicks): GradeResult {
  if (!grade.comparable || !Object.keys(picks).length) return grade;
  const regions = grade.regions.map((r) => {
    const pick = picks[r.region];
    if (!pick || !r.answerHex) return r;
    return regionGrade(r.region, hexToLab(r.answerHex), hexToLab(pick));
  });
  return { ...grade, regions, total: totalScore(regions) };
}
