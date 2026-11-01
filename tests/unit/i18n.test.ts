import { describe, expect, it } from "vitest";
import { LANG_STORAGE_KEY, MESSAGES, langFromSearch, loadLang, saveLang, t, tf } from "@/lib/i18n";
import { collectEntries } from "@/lib/i18nReview";
import { eyelidRuleRows } from "@/lib/rules/engine";

const HANGUL = /[가-힣]/;

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("S5 language toggle (#21)", () => {
  it("every UI message has non-empty ko and en, and en has no Hangul", () => {
    for (const [key, v] of Object.entries(MESSAGES)) {
      expect(v.ko, key).not.toBe("");
      expect(v.en, key).not.toBe("");
      expect(HANGUL.test(v.en), `${key}: ${v.en}`).toBe(false);
    }
  });

  it("all bilingual copy (UI, F2 labels/hints, rule table, lessons, guides) is translated", () => {
    const entries = collectEntries();
    expect(entries.length).toBeGreaterThan(200);
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(entries.length);
    for (const e of entries) {
      expect(e.en.trim(), e.id).not.toBe("");
      expect(HANGUL.test(e.en), `${e.id}: ${e.en}`).toBe(false);
      expect(HANGUL.test(e.ko) || /^[\x20-\x7E·—–→]+$/.test(e.ko), `${e.id} ko should be Korean or a shared brand/label`).toBe(true);
    }
  });

  it("placeholders survive in both languages", () => {
    expect(tf("stepNumbered", "ko", { n: 2 })).toBe("2단계");
    expect(tf("stepNumbered", "en", { n: 2 })).toBe("Step 2");
    expect(tf("answerCumulative", "en", { n: 3 })).toBe("steps 1–3");
    for (const [key, v] of Object.entries(MESSAGES)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(v.en), key).toBe(ph(v.ko));
    }
  });

  it("rule table rows switch language", () => {
    const ko = eyelidRuleRows("ko");
    const en = eyelidRuleRows("en");
    expect(ko.map((r) => r.pattern)).toEqual(en.map((r) => r.pattern));
    expect(HANGUL.test(ko[0].technique)).toBe(true);
    expect(HANGUL.test(en[0].technique)).toBe(false);
  });

  it("?lang= overrides the saved choice and the browser; junk is ignored", () => {
    const saved = memStorage({ [LANG_STORAGE_KEY]: "ko" });
    expect(loadLang(saved, "ko-KR", "?lang=en")).toBe("en");
    expect(loadLang(null, "en-US", "?x=1&lang=KO")).toBe("ko");
    expect(loadLang(saved, "en-US", "?lang=fr")).toBe("ko");
    expect(langFromSearch(undefined)).toBeNull();
  });

  it("remembers the choice; falls back to browser language; survives blocked storage", () => {
    const s = memStorage();
    expect(loadLang(s, "ko-KR")).toBe("ko");
    expect(loadLang(s, "en-US")).toBe("en");
    saveLang(s, "en");
    expect(s.m.get(LANG_STORAGE_KEY)).toBe("en");
    expect(loadLang(s, "ko-KR")).toBe("en");
    expect(loadLang(memStorage({ [LANG_STORAGE_KEY]: "fr" }), undefined)).toBe("ko");
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadLang(blocked, "en")).toBe("en");
    expect(() => saveLang(blocked, "ko")).not.toThrow();
    expect(t("start", "en")).toBe("Use my own selfie");
  });
});
