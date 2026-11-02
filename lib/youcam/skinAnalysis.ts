import type { YouCamTransport } from "./client";
import { pollTask, type PollOptions } from "./poll";
import type { SkinAnalysisResults } from "./types";
import { SKIN_ACTIONS, SKIN_ACTION_TO_KEY, skinLevel, SKIN_CONCERN_KEYS, type SkinReading } from "../skin/concerns";

export const SKIN_FEATURE = "skin-analysis";

/**
 * Skin Analysis V2.0 SD with the 4 base-relevant concerns (1-4 concerns = 9u). `format: "json"` returns the scores in the
 * response body (the default `zip` would need a download). HD and SD actions cannot be mixed; we use SD only.
 */
export function buildSkinRequest(fileId: string) {
  return { src_file_id: fileId, dst_actions: [...SKIN_ACTIONS], format: "json" as const };
}

export async function runSkinAnalysis(transport: YouCamTransport, fileId: string, poll?: PollOptions): Promise<SkinAnalysisResults> {
  const { data } = await transport.runTask(SKIN_FEATURE, buildSkinRequest(fileId));
  // The task takes about as long as Face Analyzer; the default 1.5 s / 30 s poll applies.
  return pollTask<SkinAnalysisResults>(transport, SKIN_FEATURE, data.task_id, poll);
}

/** Output items -> one reading per requested concern. A concern the API did not return is left out (never invented). */
export function normalizeSkin(r: SkinAnalysisResults): SkinReading[] {
  const out: SkinReading[] = [];
  for (const item of r.output ?? []) {
    const key = item.type ? SKIN_ACTION_TO_KEY[item.type] : undefined;
    const raw = item.ui_score ?? item.raw_score;
    if (!key || typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const score = Math.max(1, Math.min(100, Math.round(raw)));
    if (out.some((x) => x.key === key)) continue;
    out.push({ key, score, level: skinLevel(score) });
  }
  return SKIN_CONCERN_KEYS.flatMap((k) => out.filter((x) => x.key === k));
}
