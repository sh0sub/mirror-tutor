import { describe, expect, it } from "vitest";
import { LESSONS, buildLesson, recommendLesson } from "@/lib/lessons";
import { validateEffects } from "@/lib/youcam/makeupVto";
import { lessonRenderCost } from "@/lib/units";
import type { FaceProfile } from "@/lib/profile";
import { allProfiles } from "../helpers";

const mono: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };

describe("F4 lessons (3 lessons × 4 steps)", () => {
  it("ships the 3 planned lessons with 4 steps each (4u per lesson)", () => {
    expect(LESSONS.map((l) => l.id)).toEqual(["daily-k", "shading", "gradient-lip"]);
    for (const l of LESSONS) {
      expect(l.steps).toHaveLength(4);
      expect(lessonRenderCost(l.steps.length)).toBe(4);
    }
  });

  it("every lesson × every profile produces effects that pass the documented VTO schema checks", () => {
    for (const lesson of LESSONS) {
      for (const p of allProfiles()) {
        const plan = buildLesson(lesson.id, p);
        const last = plan.steps.at(-1)!;
        const problems = validateEffects(last.cumulativeEffects);
        if (problems.length) throw new Error(`${lesson.id} ${JSON.stringify(p)}: ${problems.join("; ")}`);
        // one VTO call per step: no duplicated category inside a cumulative call
        const cats = last.cumulativeEffects.map((e) => e.category);
        expect(new Set(cats).size).toBe(cats.length);
      }
    }
  });

  it("step k renders effects[1..k] cumulatively", () => {
    const plan = buildLesson("daily-k", mono);
    expect(plan.steps.map((s) => s.cumulativeEffects.length)).toEqual([2, 3, 5, 6]);
    expect(plan.steps[2].cumulativeEffects.slice(0, 3)).toEqual(plan.steps[1].cumulativeEffects);
  });

  it("matches the mockup's monolid branch for daily K-look step 3/4", () => {
    const plan = buildLesson("daily-k", mono);
    const eye = plan.steps[2];
    expect(eye.colors.map((c) => c.hex)).toEqual(["#D9A58E", "#8C5A4A", "#2B1B17"]);
    expect(eye.effects[0].pattern?.name).toBe("2colors1");
    expect(eye.reasons[0].attr).toBe("eyelid");
    const lip = plan.steps[3].effects[0];
    expect(lip.style).toMatchObject({ type: "ombre" });
    // Live API: ombre needs 2 palettes (outer sheer, inner = lesson shade) and innerColorRatio/blendStrength.
    expect(lip.style).toEqual({ type: "ombre", innerColorRatio: 40, blendStrength: 60 });
    expect(lip.palettes).toHaveLength(2);
    expect(lip.palettes?.[0]).toMatchObject({ color: "#C94F5E", colorIntensity: 18, texture: "gloss" });
    expect(lip.palettes?.[1]).toMatchObject({ color: "#C94F5E", colorIntensity: 45, texture: "gloss" });
    expect(plan.steps[3].colors.map((c) => c.hex)).toEqual(["#C94F5E"]);
  });

  it("the same lesson renders different techniques for monolid vs double (S2 premise)", () => {
    const a = buildLesson("daily-k", mono).steps[2].effects;
    const b = buildLesson("daily-k", { ...mono, eyelid: "double" }).steps[2].effects;
    expect(a[0].pattern?.name).not.toBe(b[0].pattern?.name);
    expect(a[1].palettes?.[0].colorIntensity).not.toBe(b[1].palettes?.[0].colorIntensity);
  });

  it("gradient-lip forces an ombre lip even for full lips", () => {
    const plan = buildLesson("gradient-lip", { ...mono, eyelid: "double", lipShape: "full" });
    expect(plan.steps[3].effects[0].style?.type).toBe("ombre");
  });

  it("intensity scale (S4 hook) clamps to 0..100", () => {
    const strong = buildLesson("daily-k", mono, { intensityScale: 1.2 });
    expect(strong.steps[2].effects[0].palettes?.[0].colorIntensity).toBe(60);
    expect(validateEffects(strong.steps[3].cumulativeEffects)).toEqual([]);
  });

  it("recommends a lesson from the profile", () => {
    expect(recommendLesson(mono)).toMatchObject({ lessonId: "daily-k", reason: { ko: "홑꺼풀용 가로 그라데이션 버전" } });
    expect(recommendLesson({ ...mono, eyelid: "double" }).lessonId).toBe("gradient-lip");
    expect(recommendLesson({ ...mono, eyelid: "double", lipShape: "full", faceShape: "round" }).lessonId).toBe("shading");
  });
});
