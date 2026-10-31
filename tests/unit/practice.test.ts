import { describe, expect, it } from "vitest";
import { EMPTY_LOG, PRACTICE_STORAGE_KEY, dayKey, loadConsent, loadPractice, recordPractice, saveConsent, savePractice, streakDays, weekDots } from "@/lib/practice";
import { sourceCaption } from "@/lib/labels";
import { MESSAGES } from "@/lib/i18n";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const d = (s: string) => new Date(`${s}T12:00:00`);

describe("X4 practice log", () => {
  it("records a day once and keeps the best score per lesson", () => {
    let log = recordPractice(EMPTY_LOG, "daily-k", 70, d("2026-11-02"));
    log = recordPractice(log, "daily-k", 60, d("2026-11-02"));
    log = recordPractice(log, "shading", 82, d("2026-11-02"));
    expect(log.days).toEqual(["2026-11-02"]);
    expect(log.scores).toEqual({ "daily-k": 70, shading: 82 });
  });

  it("counts consecutive days ending today or yesterday", () => {
    const log = { days: ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"], scores: {} };
    expect(streakDays(log, d("2026-11-01"))).toBe(4);
    expect(streakDays(log, d("2026-11-02"))).toBe(4); // today not done yet
    expect(streakDays(log, d("2026-11-03"))).toBe(0); // missed a day
    expect(streakDays({ days: ["2026-10-20", "2026-11-01"], scores: {} }, d("2026-11-01"))).toBe(1);
  });

  it("builds Monday-first week dots", () => {
    // 2026-11-04 is a Wednesday
    const dots = weekDots({ days: ["2026-11-02", "2026-11-04"], scores: {} }, d("2026-11-04"));
    expect(dots.map((x) => x.done)).toEqual([true, false, true, false, false, false, false]);
    expect(dots[2].today).toBe(true);
    expect(dots[3].future).toBe(true);
    expect(dayKey(d("2026-11-04"))).toBe("2026-11-04");
  });

  it("round-trips through storage and ignores corrupt data", () => {
    const st = memoryStorage();
    savePractice(st, { days: ["2026-11-01"], scores: { "daily-k": 78 } });
    expect(loadPractice(st)).toEqual({ days: ["2026-11-01"], scores: { "daily-k": 78 } });
    st.setItem(PRACTICE_STORAGE_KEY, "{not json");
    expect(loadPractice(st)).toEqual(EMPTY_LOG);
    st.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ days: ["x", "2026-11-01"], scores: { a: 500, b: 50 } }));
    expect(loadPractice(st)).toEqual({ days: ["2026-11-01"], scores: { b: 50 } });
  });
});

describe("F1 consent persistence", () => {
  it("is remembered once given and can be revoked", () => {
    const st = memoryStorage();
    expect(loadConsent(st)).toBe(false);
    saveConsent(st, true);
    expect(loadConsent(st)).toBe(true);
    saveConsent(st, false);
    expect(loadConsent(st)).toBe(false);
  });
});

describe("analyzer caption", () => {
  it("collapses identical left/right labels", () => {
    expect(sourceCaption("Single-lid / Single-lid")).toBe("Single-lid");
    expect(sourceCaption("Single-lid / Double-lid")).toBe("Single-lid / Double-lid");
  });
  it("shop title is localized in Korean", () => {
    expect(MESSAGES.shopTitle.ko).not.toBe(MESSAGES.shopTitle.en);
  });
});
