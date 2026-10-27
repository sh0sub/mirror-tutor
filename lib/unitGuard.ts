/**
 * F8 unit guard. Plan: session cap 20u (per session cookie), global daily cap (env), credit lookup
 * cached 5 minutes, and below 150 remaining units switch to the sample-model demo mode.
 *
 * Units are only charged by YouCam when a task succeeds, so callers `reserve()` before starting a
 * task (so parallel VTO requests cannot overshoot the cap) and then `commit()` on success or
 * `release()` on error.
 *
 * State lives in process memory (MVP has no DB). On serverless this is per-instance — the session cap
 * still bounds a single demo session; the daily cap is a best-effort second line.
 */

export type GuardDenyReason = "session_cap" | "daily_cap" | "demo_mode";

export interface GuardConfig {
  sessionCap: number;
  dailyCap: number;
  demoThreshold: number;
  creditTtlMs?: number;
  /** Remaining balance from YouCam (GET /s2s/v1.0/client/credit). Throw if unknown. */
  fetchCredit: () => Promise<number>;
  now?: () => number;
}

export interface GuardStatus {
  remaining: number | null;
  sessionSpent: number;
  sessionCap: number;
  dailySpent: number;
  dailyCap: number;
  demo: boolean;
}

export type Reservation =
  | { ok: true; commit: () => void; release: () => void }
  | { ok: false; reason: GuardDenyReason; status: GuardStatus };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export class UnitGuard {
  private sessions = new Map<string, { spent: number; pending: number }>();
  private daily = { day: "", spent: 0, pending: 0 };
  private credit: { value: number | null; fetchedAt: number } = { value: null, fetchedAt: -Infinity };
  private readonly ttl: number;
  private readonly now: () => number;

  constructor(private readonly cfg: GuardConfig) {
    this.ttl = cfg.creditTtlMs ?? 5 * 60 * 1000;
    this.now = cfg.now ?? Date.now;
  }

  private dayKey() {
    return new Date(this.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
  }

  private dailyBucket() {
    const day = this.dayKey();
    if (this.daily.day !== day) this.daily = { day, spent: 0, pending: 0 };
    return this.daily;
  }

  private session(id: string) {
    let s = this.sessions.get(id);
    if (!s) {
      s = { spent: 0, pending: 0 };
      this.sessions.set(id, s);
    }
    return s;
  }

  /** Cached for creditTtlMs (5 min). A failed lookup keeps the last known value (null = unknown). */
  async remaining(): Promise<number | null> {
    if (this.now() - this.credit.fetchedAt < this.ttl) return this.credit.value;
    try {
      this.credit = { value: await this.cfg.fetchCredit(), fetchedAt: this.now() };
    } catch {
      this.credit = { value: this.credit.value, fetchedAt: this.now() };
    }
    return this.credit.value;
  }

  async status(sessionId: string): Promise<GuardStatus> {
    const remaining = await this.remaining();
    const s = this.session(sessionId);
    const d = this.dailyBucket();
    return {
      remaining,
      sessionSpent: s.spent,
      sessionCap: this.cfg.sessionCap,
      dailySpent: d.spent,
      dailyCap: this.cfg.dailyCap,
      demo: remaining !== null && remaining < this.cfg.demoThreshold,
    };
  }

  async reserve(sessionId: string, cost: number): Promise<Reservation> {
    const status = await this.status(sessionId);
    const s = this.session(sessionId);
    const d = this.dailyBucket();
    if (status.demo) return { ok: false, reason: "demo_mode", status };
    if (s.spent + s.pending + cost > this.cfg.sessionCap) return { ok: false, reason: "session_cap", status };
    if (d.spent + d.pending + cost > this.cfg.dailyCap) return { ok: false, reason: "daily_cap", status };

    s.pending += cost;
    d.pending += cost;
    let settled = false;
    const settle = (charged: boolean) => {
      if (settled) return;
      settled = true;
      s.pending -= cost;
      d.pending -= cost;
      if (charged) {
        s.spent += cost;
        d.spent += cost;
        if (this.credit.value !== null) this.credit.value -= cost;
      }
    };
    return { ok: true, commit: () => settle(true), release: () => settle(false) };
  }

  /** Drop a session's counters (F9 "세션 폐기"). */
  endSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
