"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

/** Before/after slider (M3). Drag without inertia, keyboard arrows, double-tap toggles 50/100. */
export function CompareSlider({ before, after, label, beforeLabel, afterLabel, overlay, aspect = "aspect-[4/5]" }: {
  before: string;
  after: string | null;
  label: string;
  beforeLabel: string;
  afterLabel: string;
  overlay?: ReactNode;
  /** Tailwind aspect classes of the box (the photo is object-cover, so an overlay must use the same ratio). */
  aspect?: string;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastTap = useRef(0);

  const fromEvent = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
    if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
    if (e.key === "Home") setPos(0);
    if (e.key === "End") setPos(100);
  };

  return (
    <div
      ref={ref}
      className={`relative ${aspect} w-full touch-none select-none overflow-hidden bg-panel-2`}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const now = Date.now();
        if (now - lastTap.current < 300) setPos((p) => (p === 100 ? 50 : 100));
        else fromEvent(e);
        lastTap.current = now;
      }}
      onPointerMove={(e) => dragging.current && fromEvent(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory images */}
      <img src={before} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {after ? (
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- in-memory images */}
          <img src={after} alt={afterLabel} className="h-full w-full object-cover" draggable={false} />
        </div>
      ) : (
        <div className="skeleton absolute inset-y-0 right-0 opacity-70" style={{ left: `${pos}%` }} aria-hidden />
      )}
      {overlay}
      <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-1 text-xs font-bold text-canvas">{beforeLabel}</span>
      <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-xs font-bold text-on-primary">{afterLabel}</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKey}
        className="absolute inset-y-0 w-12 -translate-x-1/2 cursor-ew-resize"
        style={{ left: `${pos}%` }}
      >
        <div className="mx-auto h-full w-0.5 bg-panel shadow" />
        <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-panel text-ink shadow-md">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
