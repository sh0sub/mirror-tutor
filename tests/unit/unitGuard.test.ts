import { describe, expect, it, vi } from "vitest";
import { UnitGuard } from "@/lib/unitGuard";
import { LruCache, renderCacheKey, sha256, stableStringify } from "@/lib/cache";

function guard(over: Partial<ConstructorParameters<typeof UnitGuard>[0]> = {}) {
  let t = 0;
  const fetchCredit = over.fetchCredit ?? vi.fn(async () => 1000);
  const g = new UnitGuard({ sessionCap: 20, dailyCap: 100, demoThreshold: 150, now: () => t, ...over, fetchCredit });
  return { g, fetchCredit, tick: (ms: number) => (t += ms) };
}

describe("UnitGuard (F8)", () => {
  it("allows one full flow (10 + 4) and stops the session at 20u", async () => {
    const { g } = guard();
    const a = await g.reserve("s1", 10);
    expect(a.ok).toBe(true);
    if (a.ok) a.commit();
    for (let i = 0; i < 10; i++) {
      const r = await g.reserve("s1", 1);
      expect(r.ok).toBe(true);
      if (r.ok) r.commit();
    }
    const over = await g.reserve("s1", 1);
    expect(over).toMatchObject({ ok: false, reason: "session_cap" });
    // another session is unaffected
    expect((await g.reserve("s2", 10)).ok).toBe(true);
  });

  it("counts pending reservations so 4 parallel VTO requests cannot overshoot", async () => {
    const { g } = guard({ sessionCap: 12 });
    const first = await g.reserve("s", 10);
    if (first.ok) first.commit();
    const rs = await Promise.all([1, 2, 3, 4].map(() => g.reserve("s", 1)));
    expect(rs.filter((r) => r.ok)).toHaveLength(2);
  });

  it("release() (task error) does not charge — units are charged only on success", async () => {
    const { g } = guard();
    const r = await g.reserve("s", 10);
    if (r.ok) r.release();
    expect((await g.status("s")).sessionSpent).toBe(0);
    const r2 = await g.reserve("s", 10);
    if (r2.ok) {
      r2.commit();
      r2.commit(); // idempotent
    }
    expect((await g.status("s")).sessionSpent).toBe(10);
  });

  it("enforces the global daily cap and resets it at KST midnight", async () => {
    const { g, tick } = guard({ sessionCap: 1000, dailyCap: 15 });
    const a = await g.reserve("a", 10);
    if (a.ok) a.commit();
    expect(await g.reserve("b", 10)).toMatchObject({ ok: false, reason: "daily_cap" });
    tick(24 * 60 * 60 * 1000);
    expect((await g.reserve("b", 10)).ok).toBe(true);
  });

  it("switches to demo mode when remaining < 150", async () => {
    const { g } = guard({ fetchCredit: async () => 149 });
    expect((await g.status("s")).demo).toBe(true);
    expect(await g.reserve("s", 1)).toMatchObject({ ok: false, reason: "demo_mode" });
    const { g: g2 } = guard({ fetchCredit: async () => 150 });
    expect((await g2.status("s")).demo).toBe(false);
  });

  it("caches the credit lookup for 5 minutes and decrements it locally on commit", async () => {
    const { g, fetchCredit, tick } = guard({ fetchCredit: vi.fn(async () => 160) });
    await g.status("s");
    await g.status("s");
    expect(fetchCredit).toHaveBeenCalledTimes(1);
    const r = await g.reserve("s", 10);
    if (r.ok) r.commit();
    const st = await g.status("s");
    expect(st.remaining).toBe(150);
    const r2 = await g.reserve("s", 1);
    if (r2.ok) r2.commit();
    expect((await g.status("s")).demo).toBe(true); // 149 < 150
    tick(5 * 60 * 1000);
    await g.status("s");
    expect(fetchCredit).toHaveBeenCalledTimes(2);
  });

  it("unknown credit (lookup failed) does not force demo mode", async () => {
    const { g } = guard({ fetchCredit: async () => Promise.reject(new Error("401")) });
    const st = await g.status("s");
    expect(st.remaining).toBeNull();
    expect(st.demo).toBe(false);
  });

  it("free 1,000u budget: ~70 full sessions would be needed to reach demo mode at 150u", async () => {
    let balance = 1000;
    const g = new UnitGuard({ sessionCap: 20, dailyCap: 100000, demoThreshold: 150, creditTtlMs: 0, fetchCredit: async () => balance });
    let sessions = 0;
    for (;;) {
      const r = await g.reserve(`s${sessions}`, 14);
      if (!r.ok) {
        expect(r.reason).toBe("demo_mode");
        break;
      }
      r.commit();
      balance -= 14;
      sessions++;
    }
    expect(sessions).toBe(Math.ceil((1000 - 150 + 1) / 14));
    expect(balance).toBeLessThan(150);
  });
});

describe("render cache", () => {
  it("LRU evicts least-recently-used and expires after TTL", () => {
    let t = 0;
    const c = new LruCache<number>(2, 1000, () => t);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    t = 1000;
    expect(c.get("a")).toBeUndefined();
  });

  it("key = sha256(image) + sha256(effects), independent of key order", () => {
    const img = sha256(new Uint8Array([1, 2, 3]));
    const k1 = renderCacheKey(img, [{ category: "lip_color", palettes: [{ color: "#C94F5E", colorIntensity: 45 }] }]);
    const k2 = renderCacheKey(img, [{ palettes: [{ colorIntensity: 45, color: "#C94F5E" }], category: "lip_color" }]);
    const k3 = renderCacheKey(img, [{ category: "lip_color", palettes: [{ color: "#C94F5E", colorIntensity: 46 }] }]);
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1.startsWith(img)).toBe(true);
    expect(stableStringify({ b: 1, a: undefined, c: [2] })).toBe('{"b":1,"c":[2]}');
  });
});
