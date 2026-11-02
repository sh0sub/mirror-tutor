import { trackSessionImage, type Runtime } from "../runtime";
import { sanitizeImage, ImageRejectedError } from "../privacy/sanitize";
import { sha256 } from "../cache";
import { uploadImage } from "../youcam/file";
import { normalizeSkin, runSkinAnalysis } from "../youcam/skinAnalysis";
import { YouCamTaskError, YouCamTimeoutError, type PollOptions } from "../youcam/poll";
import { YouCamHttpError } from "../youcam/client";
import { SKIN_COST } from "../units";
import { guideForErrorCode, type GuideKey } from "../quality/messages";
import { safeLog } from "../privacy/log";
import { sampleSkinCheck, type SampleId } from "../demo/sample";
import { unitInfo, type ServiceMode, type UnitInfo } from "./analyze";
import { sampleUnits } from "./sample";
import type { SkinCheck } from "../skin/concerns";

export type SkinResult =
  | { ok: true; mode: ServiceMode; skin: SkinCheck; units: UnitInfo }
  | { ok: false; status: number; code: string; guide: GuideKey; demoAvailable: boolean };

/** The sample trial: replay the pre-generated result. Takes no Runtime, so it cannot reach the transport or the unit guard (0u). */
export function skinSample(sessionCap: number, id: SampleId): SkinResult {
  return { ok: true, mode: "sample", skin: sampleSkinCheck(id), units: sampleUnits(sessionCap) };
}

/**
 * Opt-in Skin check (9u): sanitize -> reuse the Face Analyzer upload when this photo was analyzed in the session (same hash, no
 * re-upload) -> skin-analysis (SD, 4 concerns) -> poll -> normalized readings. Reserved against the same unit guard as every other call.
 */
export async function analyzeSkin(rt: Runtime, sessionId: string, input: Uint8Array, poll?: PollOptions): Promise<SkinResult> {
  let image: Uint8Array;
  try {
    image = (await sanitizeImage(input)).bytes;
  } catch (e) {
    const code = e instanceof ImageRejectedError ? e.code : "undecodable";
    return { ok: false, status: 400, code, guide: code === "too_small" ? "face_too_small" : "retry", demoAvailable: false };
  }

  const reservation = await rt.guard.reserve(sessionId, SKIN_COST);
  if (!reservation.ok) {
    // Below the demo threshold nothing live runs; the skin check just stays unavailable (the lesson works without it).
    return { ok: false, status: 429, code: reservation.reason, guide: "credit", demoAvailable: reservation.reason === "demo_mode" };
  }

  try {
    const hash = sha256(image);
    const fileId = rt.fileIds.get(hash) ?? (await uploadImage(rt.transport, image));
    const results = await runSkinAnalysis(rt.transport, fileId, poll);
    reservation.commit();
    rt.fileIds.set(hash, fileId);
    trackSessionImage(rt, sessionId, hash);
    const readings = normalizeSkin(results);
    if (readings.length === 0) return { ok: false, status: 502, code: "empty_skin_result", guide: "retry", demoAvailable: false };
    const st = await rt.guard.status(sessionId);
    return { ok: true, mode: rt.transport.kind, skin: { readings, source: "live" }, units: unitInfo(SKIN_COST, st) };
  } catch (e) {
    if (e instanceof YouCamTimeoutError) reservation.commit();
    else reservation.release();
    safeLog("warn", "skin analysis failed", e);
    if (e instanceof YouCamTaskError) return { ok: false, status: 422, code: e.code, guide: guideForErrorCode(e.code), demoAvailable: false };
    if (e instanceof YouCamHttpError) {
      return { ok: false, status: e.code === "CreditInsufficiency" ? 429 : 502, code: e.code, guide: guideForErrorCode(e.code), demoAvailable: false };
    }
    if (e instanceof YouCamTimeoutError) return { ok: false, status: 504, code: "timeout", guide: "retry", demoAvailable: false };
    return { ok: false, status: 500, code: "internal", guide: "retry", demoAvailable: false };
  }
}
