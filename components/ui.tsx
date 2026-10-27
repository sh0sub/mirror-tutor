"use client";

import Link from "next/link";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFlow } from "./FlowProvider";
import { t } from "@/lib/i18n";

/* ── icons (24 viewBox, stroke) ─────────────────────────────── */
const paths = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  warn: "M12 3l10 18H2z M12 10v5 M12 18v.5",
  back: "M19 12H5 M11 6l-6 6 6 6",
  camera: "M4 8h3l2-3h6l2 3h3v11H4z M12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  upload: "M12 19V8 M7 13l5-5 5 5 M4 4h16",
  pencil: "M4 20h4l11-11-4-4L4 16z",
  bag: "M6 8h12l-1 12H7z M9 8a3 3 0 016 0",
  share: "M12 4v11 M7 9l5-5 5 5 M5 14v6h14v-6",
  download: "M12 4v11 M7 10l5 5 5-5 M4 20h16",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6",
  plus: "M12 5v14 M5 12h14",
  x: "M6 6l12 12 M18 6L6 18",
  info: "M12 8v.5 M12 11v6 M12 21a9 9 0 100-18 9 9 0 000 18z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  trash: "M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13",
};
export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-5 w-5", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={paths[name]} />
    </svg>
  );
}

/* ── buttons ─────────────────────────────────────────────── */
type Variant = "primary" | "ghost" | "soft";
const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-strong disabled:bg-line disabled:text-muted",
  ghost: "border border-line-strong/50 bg-panel text-ink hover:bg-panel-2 disabled:text-muted",
  soft: "bg-peach-soft text-primary-strong hover:bg-peach disabled:text-muted",
};

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] px-5 text-[15px] font-bold transition-colors duration-200 disabled:cursor-not-allowed ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", className = "", children, ...rest }: { href: string; variant?: Variant; className?: string; children: ReactNode; "aria-label"?: string }) {
  return (
    <Link href={href} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] px-5 text-[15px] font-bold transition-colors duration-200 ${variantClass[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

/* ── chips (state = color + icon, never color alone) ───────── */
type ChipTone = "ok" | "warn" | "bad" | "neutral" | "accent";
const chipClass: Record<ChipTone, string> = {
  ok: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  bad: "bg-danger-soft text-danger",
  neutral: "bg-panel-2 text-muted",
  accent: "bg-peach-soft text-primary-strong",
};
export function Chip({ tone = "neutral", children, icon }: { tone?: ChipTone; children: ReactNode; icon?: IconName }) {
  const auto: IconName | undefined = icon ?? (tone === "ok" ? "check" : tone === "warn" || tone === "bad" ? "warn" : undefined);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${chipClass[tone]}`}>
      {auto && <Icon name={auto} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

/* ── app bar ─────────────────────────────────────────────── */
export function AppBar({ title, backHref, right }: { title: string; backHref?: string; right?: ReactNode }) {
  const { lang, setLang } = useFlow();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-canvas/95 px-2 backdrop-blur">
      {backHref ? (
        <Link href={backHref} className="inline-flex h-12 w-12 items-center justify-center rounded-full hover:bg-panel-2" aria-label={t("back", lang)}>
          <Icon name="back" />
        </Link>
      ) : (
        <span className="inline-flex h-12 items-center gap-2 pl-2 text-primary">
          <Icon name="sparkle" className="h-5 w-5" />
        </span>
      )}
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">{title}</h1>
      {right}
      <div role="group" aria-label="Language" className="flex rounded-full bg-panel-2 p-0.5 text-xs font-bold">
        {(["ko", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`min-h-10 min-w-11 rounded-full px-2 uppercase ${lang === l ? "bg-panel text-ink shadow-sm" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </header>
  );
}

/* ── layout helpers ───────────────────────────────────────── */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas">{children}</div>;
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-canvas/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {children}
    </div>
  );
}

/* ── sheet (modal dialog) ─────────────────────────────────── */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40 sm:mx-auto sm:max-w-[480px]"
    >
      <div className="rounded-t-[var(--radius-sheet)] bg-panel px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

/* ── unit badge + mode banner ─────────────────────────────── */
export function UnitLine({ costKey }: { costKey: "analyzerCost" | "renderCost" }) {
  const { lang, credit } = useFlow();
  return (
    <p className="text-center text-xs text-muted">
      {t(costKey, lang)}
      {credit?.remaining != null && (
        <>
          {" · "}
          {t("remaining", lang)} <span className="num font-bold text-ink">{credit.remaining}</span>
        </>
      )}
    </p>
  );
}

export function ModeBanner() {
  const { lang, credit, mode } = useFlow();
  const demo = mode === "demo" || credit?.demo;
  const mock = !demo && (mode === "mock" || credit?.mode === "mock");
  if (!demo && !mock) return null;
  return (
    <p role="status" className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
      <Icon name="info" className="mt-0.5 h-4 w-4 flex-none" />
      {demo ? t("demoBanner", lang) : t("mockBanner", lang)}
    </p>
  );
}

export function Swatch({ hex, selected, onClick, label }: { hex: string; selected?: boolean; onClick?: () => void; label?: string }) {
  const inner = (
    <>
      <span className="h-6 w-6 rounded-full border border-ink/10" style={{ background: hex }} aria-hidden />
      <span className="num text-xs font-bold">{hex}</span>
    </>
  );
  if (!onClick) return <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 py-1 pl-1 pr-2.5">{inner}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label ?? hex}
      className={`inline-flex min-h-12 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 ${selected ? "bg-peach-soft ring-2 ring-primary" : "bg-panel-2"}`}
    >
      {inner}
    </button>
  );
}
