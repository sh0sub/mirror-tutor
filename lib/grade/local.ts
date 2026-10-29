import sharp from "sharp";
import { GRADE_REGIONS, gradeCropBox, toPixels, type GradeRegion } from "../regions";
import { deltaE2000, rgbToLab, type Lab } from "../color";
import { estimateFace, luma } from "../quality/gate";
import type { Text } from "../rules/engine";
import type { Confidence, GradeResult, RegionGrade } from "./types";
import type { LandmarkMeasure } from "./landmarks";

/**
 * Deterministic MVP grader (no LLM, no units): compares the mean CIELAB color of each region crop
 * between the answer (VTO step 4) and the attempt photo. Also used as the numeric evidence passed to
 * the Claude grader and as its fallback. Region boxes assume both photos were taken in the guide oval;
 * S1 (landmark-aligned ΔE) replaces the fixed boxes.
 */

const WIDTH = 480;

interface Prepared {
  data: Uint8Array;
  width: number;
  height: number;
}

async function prepare(img: Uint8Array, width = WIDTH, height?: number): Promise<Prepared> {
  const { data, info } = await sharp(img)
    .rotate()
    .resize({ width, height, fit: "cover" })
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

function meanLab(p: Prepared, region: GradeRegion): Lab {
  const box = toPixels(gradeCropBox(region, 0), p.width, p.height);
  // central 70% of the box to avoid edges
  const x0 = box.left + Math.floor(box.width * 0.15);
  const x1 = box.left + Math.ceil(box.width * 0.85);
  const y0 = box.top + Math.floor(box.height * 0.15);
  const y1 = box.top + Math.ceil(box.height * 0.85);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * p.width + x) * 4;
      r += p.data[i];
      g += p.data[i + 1];
      b += p.data[i + 2];
      n++;
    }
  }
  return n ? rgbToLab(r / n, g / n, b / n) : [0, 0, 0];
}

function frameLuma(p: Prepared): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < p.data.length; i += 16) {
    s += luma(p.data[i], p.data[i + 1], p.data[i + 2]);
    n++;
  }
  return n ? s / n : 0;
}

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

export interface LocalMeasure {
  comparable: boolean;
  confidence: Confidence;
  confidenceReason: Text | null;
  regions: RegionGrade[];
}

export async function measure(answer: Uint8Array, attempt: Uint8Array): Promise<LocalMeasure> {
  const a = await prepare(answer);
  const b = await prepare(attempt, a.width, a.height);

  const fa = estimateFace(a);
  const fb = estimateFace(b);
  const comparable = fa.skinRatio > 0.05 && fb.skinRatio > 0.05 && Math.abs(fa.width - fb.width) <= 0.18 && Math.abs(fa.center - fb.center) <= 0.1;

  const lumaDiff = Math.abs(frameLuma(a) - frameLuma(b));
  const confidence: Confidence = lumaDiff > 30 ? "low" : lumaDiff > 14 ? "medium" : "high";
  const confidenceReason: Text | null =
    confidence === "high" ? null : { ko: "조명이 정답 촬영과 달라요", en: "Lighting differs from the answer photo" };

  const regions = GRADE_REGIONS.map((region) => regionGrade(region, meanLab(a, region), meanLab(b, region)));
  return { comparable, confidence, confidenceReason, regions };
}

/** Score + rule tip for one region from the answer/attempt mean colors (shared by box and landmark measures). */
export function regionGrade(region: GradeRegion, la: Lab, lb: Lab): RegionGrade {
  const dE = deltaE2000(la, lb);
  const score = scoreFromDeltaE(dE);
  let kind: TipKind = "good";
  // attempt lighter than the answer → not enough product ("more"); darker → too much ("less")
  if (score < 80) kind = lb[0] > la[0] + 3 ? "more" : lb[0] < la[0] - 3 ? "less" : "hue";
  return { region, score, tip: TIPS[region][kind], deltaE: Math.round(dE * 10) / 10 };
}

/**
 * S1: grade from browser-measured landmark polygons. ΔE is recomputed here from the submitted Lab
 * means (the client's own ΔE is not trusted). Lighting confidence still comes from the images.
 */
export async function measureWithLandmarks(answer: Uint8Array, attempt: Uint8Array, lm: LandmarkMeasure): Promise<LocalMeasure> {
  const a = await prepare(answer);
  const b = await prepare(attempt, a.width, a.height);
  const lumaDiff = Math.abs(frameLuma(a) - frameLuma(b));
  const confidence: Confidence = lumaDiff > 30 ? "low" : lumaDiff > 14 ? "medium" : "high";
  const byRegion = new Map(lm.regions.map((r) => [r.region, r]));
  const regions = GRADE_REGIONS.map((region) => {
    const r = byRegion.get(region)!;
    return regionGrade(region, r.answerLab, r.attemptLab);
  });
  return {
    comparable: true, // both faces were found by the landmarker
    confidence,
    confidenceReason: confidence === "high" ? null : { ko: "조명이 정답 촬영과 달라요", en: "Lighting differs from the answer photo" },
    regions,
  };
}

export async function gradeLocal(answer: Uint8Array, attempt: Uint8Array): Promise<GradeResult> {
  const m = await measure(answer, attempt);
  if (!m.comparable) {
    return { comparable: false, total: null, confidence: "low", confidenceReason: { ko: "각도가 많이 달라요", en: "The angle is too different" }, regions: [], grader: "local", units: 0 };
  }
  const total = Math.round(m.regions.reduce((s, r) => s + r.score, 0) / m.regions.length);
  return { comparable: true, total, confidence: m.confidence, confidenceReason: m.confidenceReason, regions: m.regions, grader: "local", units: 0 };
}

/** JPEG crops for the LLM grader (small, region-only — never the full face). */
export async function regionCrops(img: Uint8Array, width: number, height: number): Promise<Record<GradeRegion, string>> {
  const base = sharp(img).rotate().resize({ width, height, fit: "cover" });
  const buf = await base.jpeg({ quality: 85 }).toBuffer();
  const out = {} as Record<GradeRegion, string>;
  for (const r of GRADE_REGIONS) {
    const box = toPixels(gradeCropBox(r), width, height);
    const crop = await sharp(buf).extract(box).resize({ width: 256, withoutEnlargement: false }).jpeg({ quality: 85 }).toBuffer();
    out[r] = crop.toString("base64");
  }
  return out;
}

export const GRADE_WIDTH = WIDTH;
