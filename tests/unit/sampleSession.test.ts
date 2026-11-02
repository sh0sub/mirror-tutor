import { describe, expect, it } from "vitest";
import { loadSampleSession, saveSampleSession, SAMPLE_SESSION_KEY } from "@/lib/demo/sampleSession";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const profile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" } as const;

describe("sample trial survives a reload (sessionStorage)", () => {
  it("round-trips the sample id and the 5 attributes only", () => {
    const s = mem();
    saveSampleSession(s, { id: "model-c", stored: { profile, edited: ["eyelid"] } });
    expect(loadSampleSession(s)).toEqual({ id: "model-c", stored: { profile, edited: ["eyelid"] } });
    expect(s.m.get(SAMPLE_SESSION_KEY)).not.toMatch(/blob|photo|http/);
  });
  it("clears on null and ignores corrupt or unknown data", () => {
    const s = mem();
    saveSampleSession(s, { id: "model-a", stored: null });
    saveSampleSession(s, null);
    expect(loadSampleSession(s)).toBeNull();
    s.setItem(SAMPLE_SESSION_KEY, "{not json");
    expect(loadSampleSession(s)).toBeNull();
    s.setItem(SAMPLE_SESSION_KEY, JSON.stringify({ id: "someone-else", stored: null }));
    expect(loadSampleSession(s)).toBeNull();
    s.setItem(SAMPLE_SESSION_KEY, JSON.stringify({ id: "model-a", stored: { profile: { eyelid: "x" }, edited: [] } }));
    expect(loadSampleSession(s)).toEqual({ id: "model-a", stored: null });
  });
  it("a blocked storage never throws", () => {
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(() => saveSampleSession(bad, null)).not.toThrow();
    expect(loadSampleSession(bad)).toBeNull();
  });
});
