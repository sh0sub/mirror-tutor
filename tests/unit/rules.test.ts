import { describe, expect, it } from "vitest";
import { eyelidRuleRows, resolveTechniques } from "@/lib/rules/engine";
import { findPattern } from "@/lib/youcam/makeupVto";
import type { FaceProfile } from "@/lib/profile";
import { allProfiles } from "../helpers";
import { VALUE_LABEL } from "@/lib/labels";

const base: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };

describe("F3 technique rule table", () => {
  it("covers every combination (4 eyelids × 3 eye shapes × 3 lips × 7 faces × 5 brows) with catalog-valid patterns", () => {
    let n = 0;
    for (const p of allProfiles()) {
      const r = resolveTechniques(p);
      expect(findPattern("eye_shadow", r.eye.shadow.pattern)?.colorNum).toBe(2);
      expect(findPattern("eye_liner", r.eye.liner.pattern)?.colorNum).toBe(1);
      expect(findPattern("blush", r.cheek.pattern)?.colorNum).toBe(1);
      expect(findPattern("contour", r.contour.pattern)).toBeDefined();
      expect(findPattern("eyebrows", r.brow.pattern)).toBeDefined();
      n++;
    }
    expect(n).toBe(4 * 3 * 3 * 7 * 5);
  });

  it("branches the eye technique on the eyelid (the demo's 'same look, different face')", () => {
    const mono = resolveTechniques(base);
    const dbl = resolveTechniques({ ...base, eyelid: "double" });
    expect(mono.eye.shadow.pattern).not.toBe(dbl.eye.shadow.pattern);
    expect(mono.eye.liner.pattern).not.toBe(dbl.eye.liner.pattern);
    expect(mono.eye.reasons[0].why.ko).toContain("1.5mm");
  });

  it("round eyes switch the liner to a wing and add a reason; almond adds none", () => {
    const round = resolveTechniques({ ...base, eyeShape: "round" });
    expect(round.eye.liner.pattern).toBe("OpenWings1");
    expect(round.eye.reasons.map((r) => r.attr)).toEqual(["eyelid", "eyeShape"]);
    expect(resolveTechniques(base).eye.reasons).toHaveLength(1);
  });

  it("thin lips → ombre gradient gloss with the fields the API requires", () => {
    const thin = resolveTechniques(base).lip;
    expect(thin.style).toMatchObject({ type: "ombre", innerColorRatio: 40, blendStrength: 60 });
    expect(thin.texture).toBe("gloss");
    expect(thin.textureParams).toHaveProperty("gloss");
    expect(thin.textureParams).toHaveProperty("transparencyIntensity");
    expect(resolveTechniques({ ...base, lipShape: "full" }).lip.style.type).toBe("full");
  });

  it("every value has ko/en labels and every reason has ko/en text", () => {
    for (const [, values] of Object.entries(VALUE_LABEL)) {
      for (const t of Object.values(values)) expect(t.ko && t.en).toBeTruthy();
    }
    for (const p of [base, { ...base, eyelid: "hooded" as const, eyeShape: "narrow" as const, faceShape: "heart" as const }]) {
      const r = resolveTechniques(p);
      for (const reason of [...r.eye.reasons, ...r.lip.reasons, ...r.cheek.reasons, ...r.brow.reasons]) {
        expect(reason.why.ko.length).toBeGreaterThan(10);
        expect(reason.why.en.length).toBeGreaterThan(10);
      }
    }
  });

  it("exposes the eyelid → technique table for the screen", () => {
    const rows = eyelidRuleRows("ko");
    expect(rows.map((r) => r.value)).toEqual(["monolid", "inner_double", "double", "hooded"]);
    expect(rows[0].technique).toBe("가로 그라데이션 + 보이는 라인");
  });
});

describe("monolid rule basis (rule of thumb, not a Perfect Corp result)", () => {
  const base = allProfiles().next().value as FaceProfile;
  const basisOf = (eyelid: FaceProfile["eyelid"]) => resolveTechniques({ ...base, eyelid }).eye.reasons.find((r) => r.attr === "eyelid")?.basis;
  it("monolid carries a KO+EN basis that explains vertical vs horizontal and disclaims the source", () => {
    const b = basisOf("monolid");
    expect(b?.en).toMatch(/horizontal gradient reads as cleaner depth/);
    expect(b?.en).toMatch(/vertical blend is hidden by the lid fold/);
    expect(b?.en).not.toMatch(/disappears/);
    expect(b?.ko).toMatch(/둘 다 렌더/);
    expect(b?.en).toMatch(/rule of thumb from public makeup tutorials, not a Perfect Corp result/);
    expect(b?.ko).toMatch(/세로 블렌딩/);
    expect(b?.ko).toMatch(/Perfect Corp의 결과나 검증이 아니에요/);
  });
  it("other lid types have no basis line", () => {
    expect(basisOf("double")).toBeUndefined();
  });
});
