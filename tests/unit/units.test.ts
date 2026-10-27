import { describe, expect, it } from "vitest";
import {
  ANALYZE_COST,
  FACE_FEATURE_COUNT,
  MAKEUP_VTO_COST,
  faceAnalyzerCost,
  fullFlowCost,
  lessonRenderCost,
  revisitFlowCost,
} from "@/lib/units";
import { FACE_FEATURES } from "@/lib/youcam/faceAnalyzer";

describe("unit pricing (fixed by plan + official docs)", () => {
  it("Face Analyzer tiers: 1–5 → 10u, 6–14 → 20u, 15–28 → 30u", () => {
    expect([1, 5].map(faceAnalyzerCost)).toEqual([10, 10]);
    expect([6, 14].map(faceAnalyzerCost)).toEqual([20, 20]);
    expect([15, 28].map(faceAnalyzerCost)).toEqual([30, 30]);
    expect(() => faceAnalyzerCost(0)).toThrow();
    expect(() => faceAnalyzerCost(29)).toThrow();
  });

  it("we request exactly 5 features, so one analysis costs 10u", () => {
    expect(FACE_FEATURES).toHaveLength(FACE_FEATURE_COUNT);
    expect(ANALYZE_COST).toBe(10);
  });

  it("Makeup VTO is 1u per step (one cumulative task per step)", () => {
    expect(MAKEUP_VTO_COST).toBe(1);
    expect(lessonRenderCost(4)).toBe(4);
    expect(lessonRenderCost(5)).toBe(5);
  });

  it("flow A = 14u, flow B = 4u; a 20u session fits one full flow plus 6 re-renders", () => {
    expect(fullFlowCost()).toBe(14);
    expect(revisitFlowCost()).toBe(4);
    expect(20 - fullFlowCost()).toBe(6);
  });
});
