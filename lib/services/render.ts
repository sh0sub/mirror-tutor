import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { trackSessionImage, type Runtime } from "../runtime";
import { sanitizeImage } from "../privacy/sanitize";
import { renderCacheKey, sha256 } from "../cache";
import { uploadImage } from "../youcam/file";
import { runMakeupVto } from "../youcam/makeupVto";
import { mockRenderEffects, registerMockAnchors } from "../youcam/mockRender";
import type { FaceAnchors } from "../regions";
import { YouCamHttpError } from "../youcam/client";
import { YouCamTaskError, YouCamTimeoutError, type PollOptions } from "../youcam/poll";
import { MAKEUP_VTO_COST } from "../units";
import { buildLesson, type BuildOptions } from "../lessons";
import { guideForErrorCode, type GuideKey } from "../quality/messages";
import { safeLog } from "../privacy/log";
import type { FaceProfile } from "../profile";
import { unitInfo, type ServiceMode, type UnitInfo } from "./analyze";

export type StepResult =
  | { index: number; status: "done"; image: string; cached: boolean }
  | { index: number; status: "error"; code: string; guide: GuideKey }
  | { index: number; status: "blocked"; code: "session_cap" | "daily_cap" | "demo_mode"; guide: GuideKey };

export interface RenderRequest {
  image: Uint8Array;
  lessonId: string;
  profile: FaceProfile;
  /** 1-based step indexes to render (default all). Used for "다시 시도(1 유닛)". */
  steps?: number[];
  build?: BuildOptions;
  /** Browser-detected eye/mouth centers; only the mock renderer uses them (live YouCam finds the face itself). */
  anchors?: FaceAnchors | null;
}

export interface RenderSummary {
  mode: ServiceMode;
  spent: number;
  units: UnitInfo;
}

const toDataUrl = (b: Uint8Array) => `data:image/jpeg;base64,${Buffer.from(b).toString("base64")}`;

let demoImage: Promise<Uint8Array> | null = null;
/** Demo mode source: the illustrated sample model in public/demo (not a real person). */
export function loadDemoImage(): Promise<Uint8Array> {
  demoImage ??= readFile(path.join(process.cwd(), "public/demo/sample-model.svg")).then(
    async (svg) => new Uint8Array(await sharp(svg).jpeg({ quality: 90 }).toBuffer()),
  );
  return demoImage;
}

/**
 * F4 /api/render: one cumulative Makeup VTO task per step (1u each), all steps in parallel on the
 * same file_id, results streamed back as each finishes so the player can reveal completed steps
 * first. Cache hits cost 0u. Result images are fetched server-side and returned as data URLs;
 * the YouCam result URL never reaches the browser (privacy ③).
 */
export async function renderLesson(
  rt: Runtime,
  sessionId: string,
  req: RenderRequest,
  onStep: (r: StepResult) => void,
  poll?: PollOptions,
): Promise<RenderSummary> {
  const status0 = await rt.guard.status(sessionId);
  // The sample model is not the user's face, so demo mode keeps the lessons' default base color.
  const plan = buildLesson(req.lessonId, req.profile, status0.demo ? { ...req.build, skinShade: null } : req.build);
  const wanted = plan.steps.filter((s) => !req.steps?.length || req.steps.includes(s.index));
  let spent = 0;

  if (status0.demo) {
    // Sample-model mode: no API calls, render the illustration locally (0u).
    const demo = await loadDemoImage();
    await Promise.all(
      wanted.map(async (s) => onStep({ index: s.index, status: "done", image: toDataUrl(await mockRenderEffects(demo, s.cumulativeEffects)), cached: false })),
    );
    return { mode: "demo", spent: 0, units: unitInfo(0, status0) };
  }

  const image = (await sanitizeImage(req.image)).bytes;
  const imageHash = sha256(image);
  trackSessionImage(rt, sessionId, imageHash);
  if (req.anchors && rt.transport.kind === "mock") registerMockAnchors(imageHash, req.anchors);
  const misses = [];
  for (const s of wanted) {
    const key = renderCacheKey(imageHash, s.cumulativeEffects);
    const hit = rt.renderCache.get(key);
    if (hit) onStep({ index: s.index, status: "done", image: toDataUrl(hit), cached: true });
    else misses.push({ step: s, key });
  }

  if (misses.length) {
    let fileId = rt.fileIds.get(imageHash);
    if (!fileId) {
      try {
        fileId = await uploadImage(rt.transport, image); // upload is free; only tasks cost units
        rt.fileIds.set(imageHash, fileId);
      } catch (e) {
        safeLog("warn", "render upload failed", e);
        const code = e instanceof YouCamHttpError ? e.code : "upload_failed";
        misses.forEach(({ step }) => onStep({ index: step.index, status: "error", code, guide: "retry" }));
        return { mode: rt.transport.kind, spent, units: unitInfo(spent, await rt.guard.status(sessionId)) };
      }
    }
    const fid = fileId;
    await Promise.all(
      misses.map(async ({ step, key }) => {
        const r = await rt.guard.reserve(sessionId, MAKEUP_VTO_COST);
        if (!r.ok) {
          onStep({ index: step.index, status: "blocked", code: r.reason, guide: "credit" });
          return;
        }
        try {
          const bytes = await runMakeupVto(rt.transport, fid, step.cumulativeEffects, poll);
          r.commit();
          spent += MAKEUP_VTO_COST;
          rt.renderCache.set(key, bytes);
          onStep({ index: step.index, status: "done", image: toDataUrl(bytes), cached: false });
        } catch (e) {
          if (e instanceof YouCamTimeoutError) r.commit();
          else r.release();
          safeLog("warn", `render step ${step.index} failed`, e);
          const code = e instanceof YouCamTaskError || e instanceof YouCamHttpError ? e.code : e instanceof YouCamTimeoutError ? "timeout" : "internal";
          onStep({ index: step.index, status: "error", code, guide: guideForErrorCode(code) });
        }
      }),
    );
  }
  return { mode: rt.transport.kind, spent, units: unitInfo(spent, await rt.guard.status(sessionId)) };
}
