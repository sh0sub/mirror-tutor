"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { badgeCorner, coverFit, estimateLabelWidth, mapToBox, placePins, type LabelSide, type Size } from "@/lib/pinLayout";
import type { Pt } from "@/lib/grade/landmarks";

export interface PhotoPin {
  id: string;
  /** normalized 0..1 point in the source image */
  at: Pt;
  /** plain text (used for the width estimate and as the default content) */
  text: string;
  content?: ReactNode;
  /** extra px inside the chip besides the text (e.g. an icon) */
  extraW?: number;
  prefer: LabelSide;
}

const LABEL_H = 24;
const CHIP_CLASS = "flex items-center gap-1 rounded-full bg-panel/95 px-2 text-xs font-bold whitespace-nowrap text-ink shadow-sm";

/**
 * object-fit: cover photo with callout chips at real image positions. pins === null → photo only (no fake
 * positions). `focus` re-centers the crop on that normalized point. Pins are decorative (aria-hidden): the
 * same information is in the text below the photo.
 */
export function PhotoPins({
  src,
  alt,
  pins,
  focus,
  dots = true,
  reserve = [],
  badge,
  className = "",
  children,
}: {
  src: string;
  alt: string;
  pins: PhotoPin[] | null;
  focus?: Pt | null;
  dots?: boolean;
  /** corner overlays (status chip, caption) labels must not cover: 8px inset from that top corner */
  reserve?: { corner: "top-left" | "top-right"; w: number; h: number }[];
  /** status chip placed top-right, or top-left when a pin dot would sit under it; labels avoid it */
  badge?: { node: ReactNode; w: number; h: number };
  className?: string;
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState<Size | null>(null);
  const [loaded, setLoaded] = useState<(Size & { src: string }) | null>(null);
  const img = loaded?.src === src ? loaded : null;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Real rendered chip widths (hidden measuring layer); the conservative estimate is only the first-frame fallback.
  const measureRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && setFontsReady((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    measureRef.current?.querySelectorAll<HTMLElement>("[data-pin]").forEach((el) => (next[el.dataset.pin!] = Math.ceil(el.getBoundingClientRect().width)));
    if (badgeRef.current) next["__badge"] = Math.ceil(badgeRef.current.getBoundingClientRect().width);
    setWidths((prev) => (Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([k, v]) => prev[k] === v) ? prev : next));
  }, [pins, badge, fontsReady]);

  const fit = useMemo(() => (img && box ? coverFit(img, box, focus ?? undefined) : null), [img, box, focus]);
  const { placed, corner } = useMemo(() => {
    if (!pins || !fit || !img || !box) return { placed: [], corner: "top-right" as const };
    const byId = new Map(pins.map((p) => [p.id, p]));
    const items = pins.map((p) => ({ id: p.id, at: mapToBox(p.at, img, fit), w: widths[p.id] ?? estimateLabelWidth(p.text) + (p.extraW ?? 0), h: LABEL_H, prefer: p.prefer }));
    const badgeW = widths.__badge ?? badge?.w ?? 0;
    const corner = badge ? badgeCorner(items.map((i) => i.at), box, badgeW, badge.h) : "top-right";
    const rects = [...reserve, ...(badge ? [{ corner, w: badgeW, h: badge.h }] : [])];
    const avoid = rects.map((r) => ({ x: r.corner === "top-left" ? 8 : box.w - 8 - r.w, y: 8, w: r.w, h: r.h }));
    return { placed: placePins(items, box, { dotR: dots ? 5 : 0, avoid }).map((pl) => ({ ...pl, pin: byId.get(pl.id)! })), corner };
  }, [pins, fit, img, box, dots, reserve, badge, widths]);

  return (
    <figure ref={boxRef} className={`relative overflow-hidden bg-panel-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory object URL, not optimizable */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        style={fit ? { objectPosition: fit.objectPosition } : undefined}
        onLoad={(e) => setLoaded({ src, w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
      />
      {placed.length > 0 && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {placed.map(({ id, dot, label, pin }) => (
            <span key={id}>
              {dots && (
                <span className="absolute h-2.5 w-2.5 rounded-full border-2 border-white bg-primary shadow-sm" style={{ left: dot.x - 5, top: dot.y - 5 }} />
              )}
              <span className={`absolute overflow-hidden ${CHIP_CLASS}`} style={{ left: label.x, top: label.y, height: label.h, maxWidth: label.w }}>
                {pin.content ?? pin.text}
              </span>
            </span>
          ))}
        </div>
      )}
      {pins && (
        <div ref={measureRef} className="invisible absolute left-0 top-0" aria-hidden>
          {pins.map((p) => (
            <span key={p.id} data-pin={p.id} className={`absolute left-0 top-0 ${CHIP_CLASS}`} style={{ height: LABEL_H }}>
              {p.content ?? p.text}
            </span>
          ))}
        </div>
      )}
      {badge && (
        <span ref={badgeRef} className={`absolute top-2 flex ${corner === "top-left" ? "left-2" : "right-2"}`}>
          {badge.node}
        </span>
      )}
      {children}
    </figure>
  );
}
