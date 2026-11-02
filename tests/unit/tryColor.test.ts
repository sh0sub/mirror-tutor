import { describe, expect, it } from "vitest";
import { regradeWithShades, shadeChips } from "@/lib/grade/tryColor";
import { regionGrade, scoreFromDeltaE, totalScore } from "@/lib/grade/score";
import { regionGrade as regionGradeViaLocal } from "@/lib/grade/local";
import { deltaE2000, hexToLab } from "@/lib/color";
import { SAMPLE_GRADES, SAMPLE_ATTEMPT } from "@/lib/demo/sample";

const base = SAMPLE_GRADES[SAMPLE_ATTEMPT].grade;
const byRegion = (g: typeof base, region: string) => g.regions.find((r) => r.region === region)!;

describe("A1 /grade sample try-it (shade chips)", () => {
  it("the server grader and the browser try-it share one scoring function", () => {
    expect(regionGradeViaLocal).toBe(regionGrade);
  });

  it("pins the shipped sample grade (answer vs simulated attempt)", () => {
    expect(base.total).toBe(79);
    expect(base.regions.map((r) => [r.region, r.score, r.deltaE])).toEqual([
      ["eye_line", 77, 5.8],
      ["eye_lid", 85, 3.8],
      ["cheek", 93, 1.9],
      ["lip", 62, 9.4],
    ]);
  });

  it("no pick returns the original grade untouched", () => {
    expect(regradeWithShades(base, {})).toBe(base);
  });

  it("'Same as answer' on a region gives ΔE 0 and 100 for it, and the total is re-averaged", () => {
    const lip = byRegion(base, "lip");
    const chip = shadeChips(lip.answerHex!).find((c) => c.id === "match")!;
    const g = regradeWithShades(base, { lip: chip.hex });
    const r = byRegion(g, "lip");
    expect(r.deltaE).toBeLessThan(0.5);
    expect(r.score).toBeGreaterThanOrEqual(98);
    expect(r.tip.en).toBe("The gradient edge looks natural");
    expect(g.total).toBe(totalScore(g.regions));
    expect(g.total).toBeGreaterThan(base.total!);
    // untouched regions keep their exact numbers
    expect(byRegion(g, "cheek")).toBe(byRegion(base, "cheek"));
  });

  it("score and ΔE come from CIEDE2000 on the picked hex (recomputed, not looked up)", () => {
    const eyelid = byRegion(base, "eye_lid");
    for (const chip of shadeChips(eyelid.answerHex!)) {
      const r = byRegion(regradeWithShades(base, { eye_lid: chip.hex }), "eye_lid");
      const dE = deltaE2000(hexToLab(eyelid.answerHex!), hexToLab(chip.hex));
      expect(r.deltaE).toBe(Math.round(dE * 10) / 10);
      expect(r.score).toBe(scoreFromDeltaE(dE));
      expect(r.attemptHex).toBe(chip.hex);
    }
  });

  it("lighter vs deeper picks give the 'more' / 'less' tips and a worse score than the match", () => {
    const eyeLine = byRegion(base, "eye_line");
    const chips = Object.fromEntries(shadeChips(eyeLine.answerHex!).map((c) => [c.id, c.hex]));
    const light = byRegion(regradeWithShades(base, { eye_line: chips.lighter }), "eye_line");
    const deep = byRegion(regradeWithShades(base, { eye_line: chips.deeper }), "eye_line");
    expect(light.tip.en).toMatch(/stronger/);
    expect(deep.tip.en).toMatch(/heavy/);
    expect(light.score).toBeLessThan(80);
    expect(deep.score).toBeLessThan(80);
  });

  it("chips are valid, distinct hex colors for every region of every sample grade", () => {
    for (const { grade } of Object.values(SAMPLE_GRADES)) {
      for (const r of grade.regions) {
        const hexes = shadeChips(r.answerHex!).map((c) => c.hex);
        expect(new Set(hexes).size).toBe(hexes.length);
        for (const h of hexes) expect(h).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});
