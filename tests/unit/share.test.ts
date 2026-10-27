import { describe, expect, it } from "vitest";
import { CARD, coverCrop, drawShareCard, panelRects, type CardContext, type CardOptions } from "@/lib/share/card";

function fakeCtx() {
  const calls: Array<{ op: string; args: unknown[]; filter?: string }> = [];
  const ctx = {
    fillStyle: "",
    filter: "none",
    font: "",
    textAlign: "left",
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
    fillText: (...args: unknown[]) => calls.push({ op: "fillText", args }),
    drawImage(...args: unknown[]) {
      calls.push({ op: "drawImage", args, filter: this.filter });
    },
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    scale: (...args: unknown[]) => calls.push({ op: "scale", args }),
  };
  return { ctx: ctx as unknown as CardContext, calls };
}

const img = { width: 1200, height: 1600 };
const opts: CardOptions = {
  lessonTitle: "데일리 K-룩",
  variant: "홑꺼풀 버전",
  score: 78,
  blurFaces: true,
  hideScore: false,
  labels: { original: "원본", answer: "정답", attempt: "내 시도", scoreUnit: "점", footer: "Mirror Tutor · YouCam Face Analyzer + Makeup VTO" },
};

describe("S3 share card", () => {
  it("lays out three panels inside the 342×428 card", () => {
    const rects = panelRects();
    expect(rects).toHaveLength(3);
    for (const r of rects) expect(r.x + r.w).toBeLessThanOrEqual(CARD.width);
    expect(rects[2].y + rects[2].h).toBeLessThan(CARD.height);
  });

  it("cover-crops a portrait photo into the panel without distortion", () => {
    const c = coverCrop(1200, 1600, 102, 196);
    expect(c.w / c.h).toBeCloseTo(102 / 196, 3);
    expect(c.x).toBeGreaterThanOrEqual(0);
  });

  it("draws 3 images blurred by default and the score", () => {
    const { ctx, calls } = fakeCtx();
    drawShareCard(ctx, [img, img, img], opts);
    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws).toHaveLength(3);
    expect(draws.every((d) => d.filter === "blur(8px)")).toBe(true);
    expect(calls.some((c) => c.op === "fillText" && c.args[0] === "78")).toBe(true);
    expect(calls.find((c) => c.op === "scale")?.args).toEqual([3, 3]);
  });

  it("respects '얼굴 흐리기' off and '점수 숨기기' on", () => {
    const { ctx, calls } = fakeCtx();
    drawShareCard(ctx, [img, img, img], { ...opts, blurFaces: false, hideScore: true });
    expect(calls.filter((c) => c.op === "drawImage").every((d) => d.filter === "none")).toBe(true);
    expect(calls.some((c) => c.op === "fillText" && c.args[0] === "78")).toBe(false);
  });

  it("renders without an attempt photo (third panel empty)", () => {
    const { ctx, calls } = fakeCtx();
    drawShareCard(ctx, [img, img, null], { ...opts, score: null });
    expect(calls.filter((c) => c.op === "drawImage")).toHaveLength(2);
  });
});
