import { describe, expect, it } from "vitest";
import { facePinsFromLandmarks, gradePinsFromLandmarks } from "@/lib/facePins";
import { badgeCorner, coverFit, estimateLabelWidth, mapToBox, placePins, type PinInput } from "@/lib/pinLayout";
import type { Pt } from "@/lib/grade/landmarks";

/** Synthetic 468-point mesh: every point at the center, with the few indices the pins read moved into place. */
function mesh(overrides: Record<number, Pt>): Pt[] {
  const f = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [i, p] of Object.entries(overrides)) f[+i] = p;
  return f;
}
const FACE = mesh({
  33: { x: 0.28, y: 0.4 }, // image-left eye corners
  133: { x: 0.4, y: 0.4 },
  362: { x: 0.6, y: 0.4 },
  263: { x: 0.72, y: 0.4 },
  105: { x: 0.35, y: 0.33 },
  52: { x: 0.35, y: 0.35 },
  334: { x: 0.65, y: 0.33 },
  282: { x: 0.65, y: 0.35 },
  61: { x: 0.42, y: 0.65 },
  291: { x: 0.58, y: 0.65 },
  132: { x: 0.25, y: 0.58 },
  361: { x: 0.75, y: 0.58 },
});

describe("face pins from landmarks", () => {
  it("picks eye/cheek on the image-left side and brow/lip on the image-right side", () => {
    const p = facePinsFromLandmarks(FACE)!;
    expect(p.eye.x).toBeCloseTo(0.34);
    expect(p.eye.y).toBeCloseTo(0.4);
    expect(p.brow.x).toBeCloseTo(0.65);
    expect(p.brow.y).toBeCloseTo(0.34);
    expect(p.lip).toEqual({ x: 0.58, y: 0.65 });
    expect(p.cheek).toEqual({ x: 0.25, y: 0.58 });
  });

  it("is side-stable for a mirrored mesh (selfie camera)", () => {
    const mirrored = FACE.map((q) => ({ x: 1 - q.x, y: q.y }));
    const p = facePinsFromLandmarks(mirrored)!;
    expect(p.eye.x).toBeCloseTo(0.34);
    expect(p.lip.x).toBeCloseTo(0.58);
  });

  it("returns null for an incomplete mesh (no fake positions)", () => {
    expect(facePinsFromLandmarks(FACE.slice(0, 100))).toBeNull();
    expect(gradePinsFromLandmarks([])).toBeNull();
    expect(facePinsFromLandmarks(mesh({ 33: { x: NaN, y: 0.4 } }))).toBeNull();
  });

  it("grade pins come from the given (attempt) mesh: lip label sits at that mesh's lips", () => {
    const lipsLow = mesh(Object.fromEntries([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146].map((i) => [i, { x: 0.5, y: 0.8 }])));
    const g = gradePinsFromLandmarks(lipsLow)!;
    expect(g.lip!.x).toBeCloseTo(0.5);
    expect(g.lip!.y).toBeCloseTo(0.8);
    expect(Object.keys(g).sort()).toEqual(["cheek", "eye_lid", "eye_line", "lip"]);
  });
});

describe("cover fit", () => {
  it("portrait photo in a wide box: crops vertically and centers the focus point when possible", () => {
    const img = { w: 300, h: 400 };
    const box = { w: 360, h: 200 };
    const fit = coverFit(img, box, { x: 0.5, y: 0.5 });
    expect(fit.scale).toBeCloseTo(1.2);
    expect(fit.dx).toBeCloseTo(0);
    expect(mapToBox({ x: 0.5, y: 0.5 }, img, fit).y).toBeCloseTo(100);
    expect(fit.objectPosition).toBe("50% 50%");
  });

  it("clamps the crop at the image edge (focus near the top cannot leave a gap)", () => {
    const fit = coverFit({ w: 300, h: 400 }, { w: 360, h: 200 }, { x: 0.5, y: 0.05 });
    expect(fit.dy).toBe(0);
    expect(fit.objectPosition).toBe("50% 0%");
  });

  it("mapped point matches CSS object-position math", () => {
    const img = { w: 300, h: 400 };
    const box = { w: 360, h: 200 };
    const fit = coverFit(img, box, { x: 0.5, y: 0.4 });
    const pos = parseFloat(fit.objectPosition.split(" ")[1]) / 100;
    expect(fit.dy).toBeCloseTo((box.h - img.h * fit.scale) * pos, 0);
  });
});

describe("pin placement", () => {
  const box = { w: 360, h: 200 };
  const pin = (id: string, x: number, y: number, prefer: PinInput["prefer"], w = 90): PinInput => ({ id, at: { x, y }, w, h: 24, prefer });
  const inside = (l: { x: number; y: number; w: number; h: number }) => l.x >= 0 && l.y >= 0 && l.x + l.w <= box.w && l.y + l.h <= box.h;

  it("keeps the preferred side when it fits", () => {
    const [p] = placePins([pin("a", 200, 100, "left")], box);
    expect(p.side).toBe("left");
    expect(p.label.x + p.label.w).toBeLessThan(200);
  });

  it("flips a label to the other side near an edge and stays inside the photo", () => {
    const [l] = placePins([pin("l", 30, 100, "left")], box);
    const [r] = placePins([pin("r", 340, 100, "right")], box);
    expect(l.side).toBe("right");
    expect(r.side).toBe("left");
    expect(inside(l.label) && inside(r.label)).toBe(true);
  });

  it("clamps dots and labels inside at the corners", () => {
    const out = placePins([pin("tl", 1, 1, "left"), pin("br", 359, 199, "right")], box);
    for (const p of out) {
      expect(inside(p.label)).toBe(true);
      expect(p.dot.x).toBeGreaterThanOrEqual(11);
      expect(p.dot.y).toBeLessThanOrEqual(189);
    }
  });

  it("drops points outside the visible crop instead of moving them onto the face", () => {
    expect(placePins([pin("gone", 180, -10, "right"), pin("gone2", 400, 50, "left")], box)).toEqual([]);
  });

  it("shrinks a label wider than the box and nudges colliding labels apart", () => {
    const [wide] = placePins([pin("w", 180, 100, "center", 500)], box);
    expect(inside(wide.label)).toBe(true);
    const [a, b] = placePins([pin("a", 170, 80, "center"), pin("b", 190, 85, "center")], box);
    expect(b.label.y >= a.label.y + a.label.h || b.label.y + b.label.h <= a.label.y).toBe(true);
    expect(inside(b.label)).toBe(true);
  });

  it("a colliding label moves toward its own pin's side (lid above the eye line)", () => {
    const [line, lid] = placePins([pin("line", 170, 100, "center"), pin("lid", 200, 92, "center")], box);
    expect(lid.label.y + lid.label.h).toBeLessThanOrEqual(line.label.y);
  });

  it("moves a label off an avoided area (status chip)", () => {
    const chip = { x: 260, y: 8, w: 92, h: 24 };
    const [p] = placePins([pin("brow", 300, 20, "right", 60)], box, { avoid: [chip] });
    const l = p.label;
    expect(l.x < chip.x + chip.w && chip.x < l.x + l.w && l.y < chip.y + chip.h && chip.y < l.y + l.h).toBe(false);
  });

  it("status badge moves to the top-left only when a dot would sit under it", () => {
    expect(badgeCorner([{ x: 180, y: 100 }], box, 92, 24)).toBe("top-right");
    expect(badgeCorner([{ x: 300, y: 20 }], box, 92, 24)).toBe("top-left");
    expect(badgeCorner([{ x: 300, y: 20 }, { x: 40, y: 20 }], box, 92, 24)).toBe("top-right");
  });

  it("estimates Hangul wider than Latin and never below the padding", () => {
    expect(estimateLabelWidth("홑꺼풀")).toBeGreaterThan(estimateLabelWidth("abc"));
    expect(estimateLabelWidth("")).toBe(16);
  });
});
