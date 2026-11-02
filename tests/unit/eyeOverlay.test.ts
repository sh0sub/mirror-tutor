import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { closeupView, eyeOverlayFromLandmarks, overlayBox, techniqueDir } from "@/lib/eyeOverlay";
import { loadLang } from "@/lib/i18n";
import overlayJson from "@/public/demo/eye-overlay.json";

const lm = (id: string) => JSON.parse(readFileSync(path.join(process.cwd(), "scripts/demo", `${id}-landmarks.json`), "utf8")) as { x: number; y: number }[];

describe("C18 show-technique overlay", () => {
  it("monolid spreads sideways, every other lid shades up toward the crease", () => {
    expect(techniqueDir("monolid")).toBe("horizontal");
    for (const e of ["double", "inner_double", "hooded"] as const) expect(techniqueDir(e)).toBe("vertical");
  });

  it("public/demo/eye-overlay.json is the overlay derived from the cached landmarks", () => {
    for (const id of ["model-a", "model-c"]) expect((overlayJson as Record<string, unknown>)[id]).toEqual(eyeOverlayFromLandmarks(lm(id)));
  });

  it("geometry: lid band above the lash line, arrows point the right way, close-up stays inside the photo", () => {
    const o = eyeOverlayFromLandmarks(lm("model-c"))!;
    expect(o.eyes).toHaveLength(2);
    const [left, right] = o.eyes;
    expect(left.lid[0].x).toBeLessThan(right.lid[0].x);
    for (const e of o.eyes) {
      const h = e.arrows.horizontal, v = e.arrows.vertical;
      expect(Math.abs(h.to.x - h.from.x)).toBeGreaterThan(0.03);
      expect(h.to.y).toBeCloseTo(h.from.y, 6);
      expect(v.to.y).toBeLessThan(v.from.y);
      expect(v.to.x).toBeCloseTo(v.from.x, 6);
      for (const p of [...e.lid, ...e.crease]) expect(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1).toBe(true);
    }
    const b = overlayBox(o);
    const view = closeupView(o, 2);
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.y).toBeGreaterThanOrEqual(0);
    expect(view.x + view.w).toBeLessThanOrEqual(1.0001);
    expect(view.y + view.h).toBeLessThanOrEqual(1.0001);
    expect(view.x).toBeLessThanOrEqual(b.x);
    expect(view.x + view.w).toBeGreaterThanOrEqual(b.x + b.w);
    expect((view.w * 0.75) / view.h).toBeCloseTo(2, 5);
  });

  it("incomplete mesh → no overlay (never a guessed position)", () => {
    expect(eyeOverlayFromLandmarks(lm("model-c").slice(0, 100))).toBeNull();
  });

  it("empty browser language starts in English like the preload script", () => {
    expect(loadLang(null, "")).toBe("en");
    expect(loadLang(null, "ko-KR")).toBe("ko");
  });
});
