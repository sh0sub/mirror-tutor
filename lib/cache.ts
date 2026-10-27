import { createHash } from "node:crypto";

/** Small LRU with per-entry TTL (plan: render cache, TTL 2h = YouCam result URL lifetime). Process memory only. */
export class LruCache<V> {
  private map = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh recency
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  /** Remove every entry whose key matches (used to drop a session's renders on "세션 끝내기"). */
  deleteWhere(pred: (key: string) => boolean): number {
    let n = 0;
    for (const k of [...this.map.keys()]) {
      if (pred(k)) {
        this.map.delete(k);
        n++;
      }
    }
    return n;
  }
}

export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Deterministic JSON (sorted keys) so equal effects always hash the same. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Cache key = sha256(image) + sha256(effects) (plan F4/F8). */
export function renderCacheKey(imageHash: string, effects: unknown): string {
  return `${imageHash}:${sha256(stableStringify(effects))}`;
}

export const RENDER_TTL_MS = 2 * 60 * 60 * 1000;
