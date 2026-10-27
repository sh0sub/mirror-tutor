import { readConfig, type AppConfig } from "./config";
import { createHttpTransport, totalCredit, type YouCamTransport } from "./youcam/client";
import { createMockTransport } from "./youcam/mock";
import { UnitGuard } from "./unitGuard";
import { LruCache, RENDER_TTL_MS } from "./cache";

/**
 * Process-wide singletons (transport, unit guard, render cache). Kept on globalThis so Next dev
 * hot-reloads don't reset the counters. Tests build their own instances via `createRuntime`.
 */
export interface Runtime {
  config: AppConfig;
  transport: YouCamTransport;
  guard: UnitGuard;
  /** Render cache: key → JPEG bytes (in memory only, TTL 2h, never written to disk). */
  renderCache: LruCache<Uint8Array>;
  /** sha256(sanitized image) → YouCam file_id, so /api/render reuses the analyze upload (no re-upload, id never sent to the browser). */
  fileIds: LruCache<string>;
  /** session id → image hashes it used, so ending a session can purge its cached renders (F9). */
  sessionImages: Map<string, Set<string>>;
}

export function trackSessionImage(rt: Runtime, sessionId: string, imageHash: string) {
  let set = rt.sessionImages.get(sessionId);
  if (!set) {
    set = new Set();
    rt.sessionImages.set(sessionId, set);
  }
  set.add(imageHash);
}

/** F9 "세션 폐기": drop cached renders, file-id mapping and unit counters for this session. */
export function endSession(rt: Runtime, sessionId: string): number {
  const hashes = rt.sessionImages.get(sessionId) ?? new Set<string>();
  let purged = 0;
  for (const h of hashes) {
    purged += rt.renderCache.deleteWhere((k) => k.startsWith(`${h}:`));
    rt.fileIds.deleteWhere((k) => k === h);
  }
  rt.sessionImages.delete(sessionId);
  rt.guard.endSession(sessionId);
  return purged;
}

export function createRuntime(config: AppConfig = readConfig(), transport?: YouCamTransport): Runtime {
  const t =
    transport ??
    (config.mode === "live" ? createHttpTransport({ apiKey: config.apiKey }) : createMockTransport({ credit: config.mockCredit }));
  const guard = new UnitGuard({
    sessionCap: config.sessionCap,
    dailyCap: config.dailyCap,
    demoThreshold: config.demoThreshold,
    fetchCredit: async () => totalCredit(await t.getCredit()),
  });
  return {
    config,
    transport: t,
    guard,
    renderCache: new LruCache<Uint8Array>(200, RENDER_TTL_MS),
    fileIds: new LruCache<string>(500, RENDER_TTL_MS),
    sessionImages: new Map(),
  };
}

const g = globalThis as unknown as { __mirrorTutorRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (!g.__mirrorTutorRuntime) g.__mirrorTutorRuntime = createRuntime();
  return g.__mirrorTutorRuntime;
}

/** Test hook: install a runtime built with `createRuntime(config, mockTransport)`. */
export function setRuntime(r: Runtime | undefined) {
  g.__mirrorTutorRuntime = r;
}
