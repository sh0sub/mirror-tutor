"use client";

import type { Lang } from "@/lib/rules/engine";
import { t } from "@/lib/i18n";
import { sampleModelById, type SampleId } from "@/lib/demo/sample";

const OPTIONS: Array<{ id: SampleId; label: "sampleMono" | "sampleDouble"; hint: "sampleMonoHint" | "sampleDoubleHint" }> = [
  { id: "model-c", label: "sampleMono", hint: "sampleMonoHint" },
  { id: "model-a", label: "sampleDouble", hint: "sampleDoubleHint" },
];

/** Home CTA: which sample face the 0-unit trial runs on. Monolid walks the analyzer-misread → user-correction flow. */
export function SamplePicker({ value, onChange, lang, disabled }: { value: SampleId; onChange: (id: SampleId) => void; lang: Lang; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={t("samplePickLabel", lang)} className="grid grid-cols-2 gap-2" data-testid="sample-picker">
      {OPTIONS.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            data-sample={o.id}
            onClick={() => onChange(o.id)}
            className={`flex min-h-12 min-w-0 items-center gap-2 rounded-[var(--radius-button)] p-1.5 pr-2 text-left transition-colors duration-200 ${on ? "bg-peach-soft ring-2 ring-primary" : "border border-line-strong/50 bg-panel hover:bg-panel-2"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static pre-generated demo asset */}
            <img src={sampleModelById(o.id).original} alt="" width={36} height={36} className="h-9 w-9 flex-none rounded-full object-cover object-[50%_25%]" />
            <span className="min-w-0 leading-tight">
              <span className={`block text-[13px] font-extrabold ${on ? "text-primary-strong" : "text-ink"}`}>{t(o.label, lang)}</span>
              <span className="block text-[11px] font-medium text-muted">{t(o.hint, lang)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
