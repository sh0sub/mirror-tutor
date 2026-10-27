import type { YouCamTransport } from "./client";

export class YouCamTaskError extends Error {
  constructor(
    readonly code: string,
    readonly feature: string,
  ) {
    super(`YouCam ${feature} task error: ${code}`);
    this.name = "YouCamTaskError";
  }
}

export class YouCamTimeoutError extends Error {
  constructor(readonly feature: string, readonly waitedMs: number) {
    super(`YouCam ${feature} task still running after ${waitedMs}ms`);
    this.name = "YouCamTimeoutError";
  }
}

export interface PollOptions {
  /** plan: 1.5s interval, max 30s. */
  intervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Called once when the wait passes `slowAfterMs` (M2: "조금 더 걸리고 있어요" after 15s). */
  onSlow?: () => void;
  slowAfterMs?: number;
}

export const DEFAULT_POLL = { intervalMs: 1500, timeoutMs: 30_000, slowAfterMs: 15_000 } as const;

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Poll `GET /s2s/v2.0/task/{feature}/{task_id}` until success/error.
 * Polling matters for billing too: the docs warn that an un-polled task that times out is still charged.
 */
export async function pollTask<R>(
  transport: YouCamTransport,
  feature: string,
  taskId: string,
  opts: PollOptions = {},
): Promise<R> {
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL.intervalMs;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_POLL.timeoutMs;
  const slowAfterMs = opts.slowAfterMs ?? DEFAULT_POLL.slowAfterMs;
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? Date.now;
  const start = now();
  let slowFired = false;

  for (;;) {
    const res = await transport.getTask<R>(feature, taskId);
    const { task_status, error, results } = res.data;
    if (task_status === "success") {
      if (results === undefined) throw new YouCamTaskError("missing_results", feature);
      return results;
    }
    if (task_status === "error") throw new YouCamTaskError(error ?? "unknown_internal_error", feature);

    const waited = now() - start;
    if (!slowFired && waited >= slowAfterMs) {
      slowFired = true;
      opts.onSlow?.();
    }
    if (waited + intervalMs > timeoutMs) throw new YouCamTimeoutError(feature, waited);
    await sleep(intervalMs);
  }
}
