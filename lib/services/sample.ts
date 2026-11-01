import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildLesson, recommendLesson, type BuildOptions } from "../lessons";
import { mockRenderEffects } from "../youcam/mockRender";
import { SAMPLE_LESSON, SAMPLE_MODEL } from "../demo/sample";
import type { FaceProfile, ProfileKey } from "../profile";
import type { AnalyzeResult, UnitInfo } from "./analyze";
import type { RenderSummary, StepResult } from "./render";

/**
 * "샘플 모델로 체험하기 · 0 유닛": a visitor (or judge) chooses to run the full flow on the sample model instead of a
 * selfie. Everything here is played back from public/demo/ — the Face Analyzer profile and the 4 Makeup VTO
 * steps were generated once offline (scripts/demo/generate.ts). This module deliberately takes no Runtime:
 * it has no YouCam transport and no unit guard, so the sample path cannot call the API or spend units.
 */
export { SAMPLE_ATTEMPT, SAMPLE_LESSON, SAMPLE_MODEL } from "../demo/sample";

export function sampleUnits(sessionCap: number): UnitInfo {
  return { spent: 0, remaining: null, sessionSpent: 0, sessionCap };
}

export function analyzeSample(sessionCap: number): AnalyzeResult {
  const profile = SAMPLE_MODEL.profile;
  return {
    ok: true,
    mode: "sample",
    profile,
    source: SAMPLE_MODEL.source as Record<ProfileKey, string>,
    recommendation: recommendLesson(profile),
    units: sampleUnits(sessionCap),
  };
}

const sameProfile = (a: FaceProfile, b: FaceProfile) => (Object.keys(b) as ProfileKey[]).every((k) => a[k] === b[k]);

/** True when the request is exactly what was pre-generated (same lesson, the sample model's own profile, default intensity/base). */
export function isPregenerated(lessonId: string, profile: FaceProfile, build?: BuildOptions): boolean {
  const scales = build?.stepScales ? Object.values(build.stepScales).filter((v) => v !== undefined && v !== 1) : [];
  return lessonId === SAMPLE_LESSON && sameProfile(profile, SAMPLE_MODEL.profile) && scales.length === 0 && (build?.intensityScale ?? 1) === 1 && !build?.skinShade;
}

let original: Promise<Uint8Array> | null = null;
function loadOriginal(): Promise<Uint8Array> {
  original ??= readFile(path.join(process.cwd(), "public", SAMPLE_MODEL.original)).then((b) => new Uint8Array(b));
  return original;
}

const toDataUrl = (b: Uint8Array) => `data:image/jpeg;base64,${Buffer.from(b).toString("base64")}`;

export interface SampleRenderRequest {
  lessonId: string;
  profile: FaceProfile;
  steps?: number[];
  build?: BuildOptions;
}

/**
 * Pre-generated YouCam results are returned as static paths (/demo/model-a/step-N.jpg). Anything that was not
 * pre-generated (another lesson, an edited attribute, a ±20% intensity) is drawn locally with the preview
 * renderer on the sample model's photo — still 0 units, never a VTO task.
 */
export async function renderSample(req: SampleRenderRequest, onStep: (r: StepResult) => void, sessionCap: number): Promise<RenderSummary> {
  const build = { ...req.build, skinShade: null }; // the sample model is not the visitor's face → lesson default base color
  const plan = buildLesson(req.lessonId, req.profile, build);
  const wanted = plan.steps.filter((s) => !req.steps?.length || req.steps.includes(s.index));
  if (isPregenerated(req.lessonId, req.profile, build)) {
    for (const s of wanted) onStep({ index: s.index, status: "done", image: SAMPLE_MODEL.steps[s.index - 1], cached: true });
  } else {
    const src = await loadOriginal();
    await Promise.all(wanted.map(async (s) => onStep({ index: s.index, status: "done", image: toDataUrl(await mockRenderEffects(src, s.cumulativeEffects)), cached: false })));
  }
  return { mode: "sample", spent: 0, units: sampleUnits(sessionCap) };
}
