import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildLesson, type BuildOptions } from "../lessons";
import { mockRenderEffects } from "../youcam/mockRender";
import { analyzedProfile, DEFAULT_SAMPLE, sampleRecommendation, SAMPLE_LESSON, sampleModelById, type SampleId } from "../demo/sample";
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
export { DEFAULT_SAMPLE, isSampleId, type SampleId } from "../demo/sample";

export function sampleUnits(sessionCap: number): UnitInfo {
  return { spent: 0, remaining: null, sessionSpent: 0, sessionCap };
}

/** The sample's analysis as Face Analyzer returned it (the monolid sample comes back as Double-lid, uncorrected: the visitor fixes it on M2). */
export function analyzeSample(sessionCap: number, id: SampleId = DEFAULT_SAMPLE): AnalyzeResult {
  const profile = analyzedProfile(id);
  return {
    ok: true,
    mode: "sample",
    profile,
    source: sampleModelById(id).source as Record<ProfileKey, string>,
    recommendation: sampleRecommendation(profile),
    units: sampleUnits(sessionCap),
  };
}

const sameProfile = (a: FaceProfile, b: FaceProfile) => (Object.keys(b) as ProfileKey[]).every((k) => a[k] === b[k]);

/**
 * The pre-generated step images for this request, or null when it is not exactly what was generated (another lesson, default
 * intensity/base only). The corrected profile plays `steps`; a sample that was misread also has the analyzer's raw reading pre-generated (`rawSteps`).
 */
export function pregeneratedSteps(lessonId: string, profile: FaceProfile, build?: BuildOptions, id: SampleId = DEFAULT_SAMPLE): string[] | null {
  const scales = build?.stepScales ? Object.values(build.stepScales).filter((v) => v !== undefined && v !== 1) : [];
  if (lessonId !== SAMPLE_LESSON || scales.length > 0 || (build?.intensityScale ?? 1) !== 1 || build?.skinShade) return null;
  const m = sampleModelById(id);
  if (sameProfile(profile, m.profile)) return m.steps;
  if (m.rawProfile && m.rawSteps && sameProfile(profile, m.rawProfile)) return m.rawSteps;
  return null;
}

/** True when the request is exactly what was pre-generated (same lesson, the sample model's own profile, default intensity/base). */
export function isPregenerated(lessonId: string, profile: FaceProfile, build?: BuildOptions, id: SampleId = DEFAULT_SAMPLE): boolean {
  return pregeneratedSteps(lessonId, profile, build, id) !== null;
}

const originals = new Map<SampleId, Promise<Uint8Array>>();
function loadOriginal(id: SampleId): Promise<Uint8Array> {
  if (!originals.has(id)) originals.set(id, readFile(path.join(process.cwd(), "public", sampleModelById(id).original)).then((b) => new Uint8Array(b)));
  return originals.get(id)!;
}

const toDataUrl = (b: Uint8Array) => `data:image/jpeg;base64,${Buffer.from(b).toString("base64")}`;

export interface SampleRenderRequest {
  lessonId: string;
  profile: FaceProfile;
  steps?: number[];
  build?: BuildOptions;
  /** Which sample face (default: the double-lid one). */
  sampleId?: SampleId;
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
  const files = pregeneratedSteps(req.lessonId, req.profile, build, req.sampleId);
  if (files) {
    for (const s of wanted) onStep({ index: s.index, status: "done", image: files[s.index - 1], cached: true });
  } else {
    const src = await loadOriginal(req.sampleId ?? DEFAULT_SAMPLE);
    await Promise.all(wanted.map(async (s) => onStep({ index: s.index, status: "done", image: toDataUrl(await mockRenderEffects(src, s.cumulativeEffects)), cached: false })));
  }
  return { mode: "sample", spent: 0, units: sampleUnits(sessionCap) };
}
