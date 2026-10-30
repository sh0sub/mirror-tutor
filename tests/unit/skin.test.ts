import { afterEach, describe, expect, it } from "vitest";
import { deltaEHex, hexToLab, hexToRgb, labToHex, type Lab } from "@/lib/color";
import { LANDMARK_POLYGONS, type Pt, type RgbaImage } from "@/lib/grade/landmarks";
import { FOREHEAD_POLYGON, measureSkin } from "@/lib/skin/measure";
import { DEFAULT_SHADE_ID, PHOTO_L_LIFT, SHADES, getShade, nearestShade, parseShadeId } from "@/lib/skin/shades";
import { LESSONS, buildLesson } from "@/lib/lessons";
import { matchEffect } from "@/lib/shop";
import { renderCacheKey } from "@/lib/cache";
import { validateEffect, type Effect } from "@/lib/youcam/makeupVto";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { POST } from "@/app/api/render/route";
import type { FaceProfile } from "@/lib/profile";
import { syntheticSelfie } from "../helpers";

const profile: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };
afterEach(() => setRuntime(undefined));

/* ── synthetic face: 200×200 image, each patch polygon laid out as a ring around a center ── */
const W = 200;
const CENTERS = { left: { x: 0.3, y: 0.55 }, right: { x: 0.7, y: 0.55 }, forehead: { x: 0.5, y: 0.2 } };
function landmarks(): Pt[] {
  const pts: Pt[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.95 }));
  const ring = (idx: number[], c: Pt) => idx.forEach((i, k) => (pts[i] = { x: c.x + 0.1 * Math.cos((2 * Math.PI * k) / idx.length), y: c.y + 0.1 * Math.sin((2 * Math.PI * k) / idx.length) }));
  ring(LANDMARK_POLYGONS.cheek[0].outer, CENTERS.left);
  ring(LANDMARK_POLYGONS.cheek[1].outer, CENTERS.right);
  ring(FOREHEAD_POLYGON, CENTERS.forehead);
  return pts;
}
/** colorAt(x, y) in pixels → hex. */
function image(colorAt: (x: number, y: number) => string): RgbaImage {
  const data = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = hexToRgb(colorAt(x, y));
      data.set([r, g, b, 255], (y * W + x) * 4);
    }
  return { data, width: W, height: W };
}
const SKIN = "#DDB49B";

describe("skin tone measurement (browser, on landmarks)", () => {
  it("labToHex inverts hexToLab", () => {
    for (const h of ["#DDB49B", "#F1D4C0", "#2B1B17", "#FFFFFF", "#000000"]) expect(labToHex(hexToLab(h))).toBe(h);
  });

  it("averages the cheek + forehead patches and drops shadow / shine pixels", () => {
    const clean = measureSkin(image(() => SKIN), landmarks())!;
    expect(clean).toMatchObject({ confidence: "ok", usedForehead: true, spread: 0 });
    expect(deltaEHex(clean.hex, SKIN)).toBeLessThan(0.5);
    // ~10% black pores and ~10% white specular pixels are trimmed away
    const noisy = measureSkin(image((x, y) => ((x * 7 + y * 13) % 10 === 0 ? "#101010" : (x * 3 + y * 11) % 10 === 5 ? "#FFFFFF" : SKIN)), landmarks())!;
    expect(deltaEHex(noisy.hex, SKIN)).toBeLessThan(1);
  });

  it("ignores a forehead covered by bangs", () => {
    const m = measureSkin(image((_x, y) => (y < W * 0.35 ? "#3A2A20" : SKIN)), landmarks())!;
    expect(m.usedForehead).toBe(false);
    expect(deltaEHex(m.hex, SKIN)).toBeLessThan(0.5);
  });

  it("side light: low confidence, keeps the lit cheek that agrees with the forehead", () => {
    const m = measureSkin(image((x) => (x < W * 0.45 ? "#7A5A48" : SKIN)), landmarks())!;
    expect(m).toMatchObject({ confidence: "low", warning: "uneven_light", usedForehead: true });
    expect(deltaEHex(m.hex, SKIN)).toBeLessThan(0.5);
  });

  it("flags very dark / very bright photos and returns null without a usable face", () => {
    expect(measureSkin(image(() => "#3A2C26"), landmarks())).toMatchObject({ confidence: "low", warning: "too_dark" });
    expect(measureSkin(image(() => "#FCF6F2"), landmarks())).toMatchObject({ confidence: "low", warning: "too_bright" });
    expect(measureSkin(image(() => SKIN), landmarks().slice(0, 100))).toBeNull();
    const tiny = landmarks().map((p) => ({ x: p.x * 0.02, y: p.y * 0.02 })); // face a few pixels wide
    expect(measureSkin(image(() => SKIN), tiny)).toBeNull();
  });
});

describe("shade ladder", () => {
  it("has 6 unique shades light → deep with the old lesson base color as the default", () => {
    expect(SHADES).toHaveLength(6);
    expect(new Set(SHADES.map((s) => s.id)).size).toBe(6);
    const L = SHADES.map((s) => hexToLab(s.hex)[0]);
    expect(L).toEqual([...L].sort((a, b) => b - a));
    expect(getShade(DEFAULT_SHADE_ID)?.hex).toBe("#F1D4C0");
    for (const s of SHADES) expect(/[가-힣]/.test(s.name.en)).toBe(false);
  });

  it("maps a measured color to the nearest shade (after the photo lift)", () => {
    for (const s of SHADES) {
      const [L, a, b] = hexToLab(s.hex);
      expect(nearestShade([L - PHOTO_L_LIFT, a, b] as Lab)).toMatchObject({ shade: { id: s.id }, deltaE: 0 });
    }
    // values measured on the demo photos (public/demo/model-a, model-b) in headless Chrome
    expect(nearestShade([76.3, 11.2, 18.6]).shade.id).toBe("23N");
    expect(nearestShade([60, 6.2, 21.4]).shade.id).toBe("27W");
  });

  it("accepts only ladder ids from the client", () => {
    expect(parseShadeId("23N")).toBe("23N");
    for (const bad of ["23n", "#E6C3AA", "21", " 21N", "__proto__", "", 21, null, undefined, { id: "21N" }]) expect(parseShadeId(bad)).toBeNull();
  });

  it("every shade has a catalog foundation within ΔE 3", () => {
    for (const s of SHADES) {
      const m = matchEffect({ category: "foundation", palettes: [{ color: s.hex }] });
      expect(m.noCloseMatch).toBe(false);
      expect(m.matches[0].deltaE).toBeLessThanOrEqual(3);
      expect(m.matches[0].product.sku).toBe(`MT-CU-${s.id}`);
    }
  });
});

describe("buildLesson with a skin shade", () => {
  const foundation = (effects: Effect[]) => effects.find((e) => e.category === "foundation");

  it("replaces the foundation color in every lesson; intensities, other effects and VTO validity stay", () => {
    for (const l of LESSONS) {
      const base = buildLesson(l.id, profile);
      const deep = buildLesson(l.id, profile, { skinShade: "27W" });
      const f0 = foundation(base.steps[0].effects)!;
      const f1 = foundation(deep.steps[0].effects)!;
      expect(f1.palettes![0]).toEqual({ ...f0.palettes![0], color: "#C99B78" });
      expect(deep.steps[0].colors).toContainEqual(expect.objectContaining({ hex: "#C99B78", category: "foundation" }));
      // later cumulative steps carry the same base
      expect(foundation(deep.steps[3].cumulativeEffects)?.palettes?.[0].color).toBe("#C99B78");
      for (const s of deep.steps) expect(s.cumulativeEffects.flatMap(validateEffect)).toEqual([]);
    }
  });

  it("adjusts blush intensity by depth; absent / unknown shade → the lesson's own colors", () => {
    const blush = (shade?: string) => buildLesson("gradient-lip", profile, { skinShade: shade }).steps.flatMap((s) => s.effects).find((e) => e.category === "blush")!.palettes![0].colorIntensity!;
    expect(blush("27W")).toBe(blush() + 10);
    expect(blush("13N")).toBe(blush() - 5);
    expect(blush("21N")).toBe(blush());
    expect(buildLesson("daily-k", profile, { skinShade: "nope" })).toEqual(buildLesson("daily-k", profile));
    expect(buildLesson("daily-k", profile, { skinShade: null })).toEqual(buildLesson("daily-k", profile));
  });

  it("a different shade is a different render cache key", () => {
    const key = (shade?: string) => renderCacheKey("h", buildLesson("daily-k", profile, { skinShade: shade }).steps[0].cumulativeEffects);
    expect(key("25W")).not.toBe(key("23N"));
    expect(key("25W")).toBe(key("25W"));
  });
});

describe("POST /api/render skinShade", () => {
  async function post(skinShade?: string) {
    const seen: Effect[][] = [];
    const t = createMockTransport({ render: async (s, effects) => (seen.push(effects), s), runningPolls: 0 });
    setRuntime(createRuntime(readConfig({}), t));
    const form = new FormData();
    form.set("image", new Blob([await syntheticSelfie()], { type: "image/jpeg" }));
    form.set("lessonId", "daily-k");
    form.set("profile", JSON.stringify(profile));
    form.set("steps", "1");
    if (skinShade !== undefined) form.set("skinShade", skinShade);
    const lines = (await (await POST(new Request("http://x/api/render", { method: "POST", body: form }))).text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ type: "done", spent: 1 });
    return foundation(seen[0])!.palettes![0].color;
  }
  const foundation = (effects: Effect[]) => effects.find((e) => e.category === "foundation");

  it("renders the ladder shade; invalid values fall back to the lesson default", async () => {
    expect(await post("25W")).toBe("#D9AE8E");
    expect(await post("#123456")).toBe("#F1D4C0");
    expect(await post()).toBe("#F1D4C0");
  });
});
