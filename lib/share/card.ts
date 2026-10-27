/**
 * S3 share card: original / answer / attempt in 3 panels + score, drawn on a client-side canvas
 * (privacy ⑥ — the card is never sent to the server). Face blur (8px) is ON by default.
 * Pure layout + a draw function over a minimal 2D-context interface so it is unit-testable.
 */

export const CARD = { width: 342, height: 428, scale: 3 } as const;
const PANEL = { w: 102, h: 196, gap: 6, top: 64, side: 12 };
export const SHARE_COLORS = { canvas: "#FBF7F4", ink: "#1F1B1A", muted: "#6B605C", primary: "#C8325B", panel: "#FFFFFF" };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function panelRects(): Rect[] {
  return [0, 1, 2].map((i) => ({ x: PANEL.side + i * (PANEL.w + PANEL.gap), y: PANEL.top, w: PANEL.w, h: PANEL.h }));
}

/** object-fit: cover source rect for drawing an image of (iw × ih) into a box (w × h). */
export function coverCrop(iw: number, ih: number, w: number, h: number): Rect {
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return { x: (iw - sw) / 2, y: (ih - sh) / 2, w: sw, h: sh };
}

export interface ShareImage {
  width: number;
  height: number;
}

export interface CardContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  filter: string;
  font: string;
  textAlign: CanvasTextAlign;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(img: never, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
}

export interface CardOptions {
  lessonTitle: string;
  variant: string; // e.g. "홑꺼풀 버전"
  score: number | null;
  blurFaces: boolean;
  hideScore: boolean;
  labels: { original: string; answer: string; attempt: string; scoreUnit: string; footer: string };
}

export function drawShareCard(ctx: CardContext, images: [ShareImage, ShareImage, ShareImage | null], opts: CardOptions) {
  ctx.save();
  ctx.scale(CARD.scale, CARD.scale);
  ctx.fillStyle = SHARE_COLORS.canvas;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.font = "800 18px Manrope, 'Noto Sans KR', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Mirror Tutor", PANEL.side, 36);

  const names = [opts.labels.original, opts.labels.answer, opts.labels.attempt];
  panelRects().forEach((r, i) => {
    const img = images[i];
    ctx.fillStyle = SHARE_COLORS.panel;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (img) {
      const src = coverCrop(img.width, img.height, r.w, r.h);
      ctx.filter = opts.blurFaces ? "blur(8px)" : "none";
      ctx.drawImage(img as never, src.x, src.y, src.w, src.h, r.x, r.y, r.w, r.h);
      ctx.filter = "none";
    }
    ctx.fillStyle = i === 1 ? SHARE_COLORS.primary : SHARE_COLORS.muted;
    ctx.font = "700 11px 'Noto Sans KR', sans-serif";
    ctx.fillText(names[i], r.x, r.y + r.h + 16);
  });

  const y = PANEL.top + PANEL.h + 62;
  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.font = "700 16px 'Noto Sans KR', sans-serif";
  ctx.fillText(opts.lessonTitle, PANEL.side, y);
  ctx.fillStyle = SHARE_COLORS.muted;
  ctx.font = "500 12px 'Noto Sans KR', sans-serif";
  ctx.fillText(opts.variant, PANEL.side, y + 20);

  if (!opts.hideScore && opts.score !== null) {
    ctx.fillStyle = SHARE_COLORS.primary;
    ctx.font = "800 44px Manrope, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(opts.score), CARD.width - PANEL.side - 22, y + 14);
    ctx.font = "700 12px 'Noto Sans KR', sans-serif";
    ctx.fillText(opts.labels.scoreUnit, CARD.width - PANEL.side, y + 14);
  }

  ctx.fillStyle = SHARE_COLORS.muted;
  ctx.font = "500 11px 'Noto Sans KR', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(opts.labels.footer, PANEL.side, CARD.height - 18);
  ctx.restore();
}
