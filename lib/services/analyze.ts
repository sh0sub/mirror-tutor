import { trackSessionImage, type Runtime } from "../runtime";
import { sanitizeImage, ImageRejectedError } from "../privacy/sanitize";
import { sha256 } from "../cache";
import { uploadImage } from "../youcam/file";
import { normalizeFaceAttributes, runFaceAnalyzer } from "../youcam/faceAnalyzer";
import { YouCamTaskError, YouCamTimeoutError, type PollOptions } from "../youcam/poll";
import { YouCamHttpError } from "../youcam/client";
import { ANALYZE_COST } from "../units";
import { recommendLesson, type Recommendation } from "../lessons";
import { guideForErrorCode, type GuideKey } from "../quality/messages";
import { safeLog } from "../privacy/log";
import type { FaceProfile, ProfileKey } from "../profile";
import demoProfile from "../../public/demo/profile.json";

export type ServiceMode = "live" | "mock" | "demo";

export interface UnitInfo {
  spent: number;
  remaining: number | null;
  sessionSpent: number;
  sessionCap: number;
}

export type AnalyzeResult =
  | {
      ok: true;
      mode: ServiceMode;
      profile: FaceProfile;
      source: Record<ProfileKey, string>;
      recommendation: Recommendation;
      units: UnitInfo;
    }
  | { ok: false; status: number; code: string; guide: GuideKey; demoAvailable: boolean };

/**
 * F2 / plan step 2: sanitize (EXIF strip, ≤1600) → File API upload + PUT → face-attr-analysis
 * (5 attributes, 10u) → poll 1.5s/30s → normalized profile. The image buffer only lives in this
 * call; the file_id is cached server-side by image hash so /api/render can reuse it.
 */
export async function analyzeFace(rt: Runtime, sessionId: string, input: Uint8Array, poll?: PollOptions): Promise<AnalyzeResult> {
  let image: Uint8Array;
  try {
    image = (await sanitizeImage(input)).bytes;
  } catch (e) {
    const code = e instanceof ImageRejectedError ? e.code : "undecodable";
    return { ok: false, status: 400, code, guide: code === "too_small" ? "face_too_small" : "retry", demoAvailable: false };
  }

  const reservation = await rt.guard.reserve(sessionId, ANALYZE_COST);
  if (!reservation.ok) {
    if (reservation.reason === "demo_mode") {
      // Below 150 units: play back the sample model instead of calling the API (0u).
      const p = demoProfile.profile as FaceProfile;
      return {
        ok: true,
        mode: "demo",
        profile: p,
        source: demoProfile.source as Record<ProfileKey, string>,
        recommendation: recommendLesson(p),
        units: unitInfo(0, reservation.status),
      };
    }
    return { ok: false, status: 429, code: reservation.reason, guide: "credit", demoAvailable: true };
  }

  try {
    const fileId = await uploadImage(rt.transport, image);
    const results = await runFaceAnalyzer(rt.transport, fileId, poll);
    reservation.commit();
    const hash = sha256(image);
    rt.fileIds.set(hash, fileId);
    trackSessionImage(rt, sessionId, hash);
    const { profile, source } = normalizeFaceAttributes(results);
    const st = await rt.guard.status(sessionId);
    return {
      ok: true,
      mode: rt.transport.kind,
      profile,
      source,
      recommendation: recommendLesson(profile),
      units: unitInfo(ANALYZE_COST, st),
    };
  } catch (e) {
    // Engine errors are not billed. A poll timeout might be billed by YouCam, so count it to stay safe.
    if (e instanceof YouCamTimeoutError) reservation.commit();
    else reservation.release();
    safeLog("warn", "analyze failed", e);
    if (e instanceof YouCamTaskError) return { ok: false, status: 422, code: e.code, guide: guideForErrorCode(e.code), demoAvailable: false };
    if (e instanceof YouCamHttpError) {
      return { ok: false, status: e.code === "CreditInsufficiency" ? 429 : 502, code: e.code, guide: guideForErrorCode(e.code), demoAvailable: e.code === "CreditInsufficiency" };
    }
    if (e instanceof YouCamTimeoutError) return { ok: false, status: 504, code: "timeout", guide: "retry", demoAvailable: false };
    return { ok: false, status: 500, code: "internal", guide: "retry", demoAvailable: false };
  }
}

function unitInfo(spent: number, st: { remaining: number | null; sessionSpent: number; sessionCap: number }): UnitInfo {
  return {
    spent,
    remaining: st.remaining === null ? null : Math.floor(st.remaining),
    sessionSpent: st.sessionSpent,
    sessionCap: st.sessionCap,
  };
}

export { unitInfo };
