import { describe, expect, it } from "vitest";
import { deltaE2000, deltaEHex, hexToLab, rgbToHex } from "@/lib/color";
import { PRODUCTS, matchEffect, matchStepEffects, storeUrl } from "@/lib/shop";
import { buildLesson } from "@/lib/lessons";
import type { FaceProfile } from "@/lib/profile";

const mono: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };

describe("color science", () => {
  it("CIEDE2000 matches the Sharma et al. reference pairs", () => {
    // Sharma, Wu, Dalal (2005) test data, pairs 1, 7 and 17
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 3);
    expect(deltaE2000([50, 2.5, 0], [56, -27, -3])).toBeCloseTo(31.903, 2);
  });

  it("hex ↔ Lab basics", () => {
    expect(hexToLab("#FFFFFF")[0]).toBeCloseTo(100, 1);
    expect(hexToLab("#000000")[0]).toBeCloseTo(0, 1);
    expect(deltaEHex("#C94F5E", "#C94F5E")).toBe(0);
    expect(rgbToHex(201, 79, 94)).toBe("#C94F5E");
  });
});

describe("F7 Shop the step", () => {
  it("uses a 17-SKU pseudonymous catalog (MT Select, generic names only)", () => {
    expect(PRODUCTS).toHaveLength(17);
    for (const p of PRODUCTS) {
      expect(p.name.ko.startsWith("MT Select")).toBe(true);
      expect(p.name.en.startsWith("MT Select")).toBe(true);
    }
  });

  it("matches the daily K-look eye step to the shadow duo and the gel liner with ΔE under 3", () => {
    const eye = buildLesson("daily-k", mono).steps[2];
    const [shadow, liner] = matchStepEffects(eye.effects);
    expect(shadow.matches[0].product.sku).toBe("MT-SD-03");
    expect(shadow.matches[0].deltaE).toBeLessThan(3);
    expect(liner.matches[0].product.sku).toBe("MT-GL-01");
    expect(liner.noCloseMatch).toBe(false);
  });

  it("prefers the same texture: a gloss lip step gets the gloss tint before a closer matte one", () => {
    const lip = buildLesson("daily-k", mono).steps[3].effects[0]; // thin lips → gloss
    const m = matchEffect(lip);
    expect(m.texture).toBe("gloss");
    expect(m.matches[0].product.texture).toBe("gloss");
    const matteLip = buildLesson("daily-k", { ...mono, lipShape: "full" }).steps[3].effects[0];
    expect(matchEffect(matteLip).matches[0].product.sku).toBe("MT-VT-07");
  });

  it("no product within ΔE 5 → nearest 2 with noCloseMatch", () => {
    const m = matchEffect({ category: "lip_color", palettes: [{ color: "#3050C0", texture: "matte" }] });
    expect(m.noCloseMatch).toBe(true);
    expect(m.matches).toHaveLength(2);
    expect(matchEffect({ category: "contour", palettes: [{ color: "#A47864" }] }).matches).toHaveLength(0);
  });

  it("skips skin_smooth and links out to an external store (no checkout)", () => {
    const base = buildLesson("daily-k", mono).steps[0];
    expect(matchStepEffects(base.effects).map((m) => m.category)).toEqual(["foundation"]);
    expect(storeUrl("MT-SD-03")).toMatch(/^https:\/\//);
  });
});
