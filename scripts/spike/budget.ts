import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Unit guard for the D1 spike scripts. Two limits:
 * - per run: SPIKE_MAX_UNITS (default 55 = the plan's Day-1 budget), never exceeded by one invocation;
 * - cumulative: a ledger in .local/spike-ledger.json so repeated runs can't silently pass the Day-1 total.
 * Costs are reserved BEFORE a task is created (worst case: the task succeeds and is charged).
 */
export class SpikeBudget {
  private spentThisRun = 0;

  constructor(
    readonly maxPerRun: number,
    readonly maxTotal: number,
    private readonly ledgerPath: string | null,
  ) {}

  get ledgerTotal(): number {
    if (!this.ledgerPath || !existsSync(this.ledgerPath)) return 0;
    try {
      return Number(JSON.parse(readFileSync(this.ledgerPath, "utf8")).total) || 0;
    } catch {
      return 0;
    }
  }

  get spent(): number {
    return this.spentThisRun;
  }

  canSpend(units: number): boolean {
    return this.spentThisRun + units <= this.maxPerRun && this.ledgerTotal + units <= this.maxTotal;
  }

  /** Throws when the reservation would cross either limit. */
  reserve(units: number, what: string): void {
    if (!this.canSpend(units)) {
      throw new Error(
        `unit guard: "${what}" needs ${units}u but run=${this.spentThisRun}/${this.maxPerRun}, ledger=${this.ledgerTotal}/${this.maxTotal}`,
      );
    }
    this.spentThisRun += units;
    this.persist(units, what);
  }

  /** Give back a reservation for a task that ended in `error` (YouCam does not charge errors). */
  refund(units: number, what: string): void {
    this.spentThisRun = Math.max(0, this.spentThisRun - units);
    this.persist(-units, `refund ${what}`);
  }

  private persist(delta: number, what: string) {
    if (!this.ledgerPath) return;
    mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    const prev = existsSync(this.ledgerPath) ? JSON.parse(readFileSync(this.ledgerPath, "utf8")) : { total: 0, entries: [] };
    prev.total = (Number(prev.total) || 0) + delta;
    prev.entries.push({ at: new Date().toISOString(), delta, what });
    writeFileSync(this.ledgerPath, JSON.stringify(prev, null, 2));
  }
}

/** Remove URLs and file/task ids before anything is written to docs/ or fixtures/. */
export function redactForDocs(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^(https?|mock):\/\//.test(value)) return "[redacted-url]";
    return value;
  }
  if (Array.isArray(value)) return value.map(redactForDocs);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        /^(file_id|task_id|src_file_id|dst_id|id|url|download_url)$/.test(k) && typeof v !== "object" ? "[redacted]" : redactForDocs(v),
      ]),
    );
  }
  return value;
}

export function stats(ms: number[]) {
  if (!ms.length) return { n: 0, min: 0, avg: 0, max: 0 };
  const s = ms.map((x) => x / 1000);
  return {
    n: s.length,
    min: +Math.min(...s).toFixed(1),
    avg: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1),
    max: +Math.max(...s).toFixed(1),
  };
}
