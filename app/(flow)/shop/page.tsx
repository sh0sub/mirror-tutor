"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppBar, BottomBar, Button, Chip, Icon, ModeBanner, Screen, Sheet, Swatch } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson, getLesson } from "@/lib/lessons";
import { INVISIBLE_DELTA, matchStepEffects, storeUrl, type Product } from "@/lib/shop";
import { CATEGORY_REGION, REGIONS } from "@/lib/regions";

/** M6 Shop the step: step hex = product shade. Swatch → highlight region on the answer (0u). External store, no checkout. */
function ShopInner() {
  const { lang, stored, renders, photo, cart, addToCart, mode, skin } = useFlow();
  const params = useSearchParams();
  const lessonId = params.get("lesson") ?? "daily-k";
  const lesson = getLesson(lessonId);
  const [k, setK] = useState(Number(params.get("step") ?? 1) || 1);
  const [selected, setSelected] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<Product | null>(null);

  const skinShade = mode === "demo" ? null : (skin?.shadeId ?? null); // foundation step → the personalized shade
  const plan = useMemo(() => (stored && lesson ? buildLesson(lesson.id, stored.profile, { skinShade }) : null), [stored, lesson, skinShade]);
  if (!plan || !lesson) {
    return (
      <Screen>
        <AppBar title={t("shopTitle", lang)} backHref="/" />
        <p className="p-6 text-center text-muted">{t("noImage", lang)}</p>
      </Screen>
    );
  }
  const step = plan.steps[k - 1];
  const matches = matchStepEffects(step.effects);
  const shown = selected === null ? matches : [matches[selected]];
  const r = renders[lessonId]?.[k];
  const answer = r?.status === "done" ? r.image : mode === "demo" ? "/demo/sample-model.svg" : (photo?.url ?? null);
  const hiCategory = selected !== null ? matches[selected]?.category : null;
  const boxes = hiCategory ? (REGIONS[CATEGORY_REGION[hiCategory]] ?? []) : [];

  return (
    <Screen>
      <AppBar
        title={t("shopTitle", lang)}
        backHref={`/lesson?id=${lessonId}`}
        right={
          <span className="relative inline-flex h-12 w-12 items-center justify-center" aria-label={`${t("cart", lang)} ${cart.length}`}>
            <Icon name="bag" />
            {cart.length > 0 && <span className="num absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-on-primary">{cart.length}</span>}
          </span>
        }
      />
      <ModeBanner />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="relative mx-auto aspect-[3/4] w-40 overflow-hidden rounded-xl bg-panel-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- in-memory image */}
          {answer && <img src={answer} alt={`${t("answer", lang)} · ${k}`} className="h-full w-full object-cover" />}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {boxes.map((b, i) => (
              <rect key={i} x={b.x * 100 - 2} y={b.y * 100 - 2} width={b.w * 100 + 4} height={b.h * 100 + 4} rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1" />
            ))}
          </svg>
        </div>

        <div role="tablist" aria-label={t("stepsNav", lang)} className="flex gap-1.5 overflow-x-auto">
          {plan.steps.map((s) => (
            <button
              key={s.index}
              role="tab"
              type="button"
              aria-selected={s.index === k}
              onClick={() => {
                setK(s.index);
                setSelected(null);
              }}
              className={`min-h-12 flex-none rounded-full px-4 text-sm font-bold ${s.index === k ? "bg-ink text-canvas" : "bg-panel-2 text-muted"}`}
            >
              {s.index} {s.title[lang]}
            </button>
          ))}
        </div>

        <section aria-label={t("colorsUsed", lang)}>
          <p className="mb-1.5 text-xs font-bold text-muted">
            {tf("stepNumbered", lang, { n: k })} {step.title[lang]} · {t("colorsUsed", lang)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matches.map((m, i) => (
              <Swatch key={i} hex={m.colors[0]} selected={selected === i} onClick={() => setSelected(selected === i ? null : i)} label={`${m.category} ${m.colors.join(" / ")}`} />
            ))}
          </div>
        </section>

        <ul className="flex flex-col gap-2">
          {shown.map((m, i) => (
            <li key={`${m.category}-${i}`} className="flex flex-col gap-2">
              {m.noCloseMatch && m.matches.length > 0 && <Chip tone="warn">{t("noCloseMatch", lang)}</Chip>}
              {m.matches.length === 0 && <p className="rounded-xl bg-panel-2 p-3 text-sm text-muted">{t("noProducts", lang)} ({m.category})</p>}
              {m.matches.map(({ product: p, deltaE, textureMatch }) => {
                const inCart = cart.includes(p.sku);
                return (
                  <article key={p.sku} className="flex items-center gap-3 rounded-[var(--radius-panel)] bg-panel p-3">
                    <div className="flex h-16 w-16 flex-none overflow-hidden rounded-xl" aria-hidden>
                      {p.shades.map((h) => (
                        <span key={h} className="flex-1" style={{ background: h }} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold leading-snug">{p.name[lang]}</h3>
                      <p className="num text-xs text-muted">{p.shades.join(" / ")}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Chip tone={deltaE <= INVISIBLE_DELTA ? "ok" : "neutral"} icon={deltaE <= INVISIBLE_DELTA ? "check" : undefined}>
                          <span className="num">ΔE {deltaE.toFixed(1)}</span>
                        </Chip>
                        {!textureMatch && <Chip tone="warn">{t("textureMismatch", lang)}</Chip>}
                        <span className="num text-sm font-bold">{lang === "ko" ? `₩${p.priceKrw.toLocaleString("ko-KR")}` : `$${p.priceUsd}`}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => addToCart(p.sku)}
                        aria-label={`${t("addToCart", lang)}: ${p.name[lang]}`}
                        aria-pressed={inCart}
                        className={`flex h-12 w-12 items-center justify-center rounded-full ${inCart ? "bg-success-soft text-success" : "bg-peach-soft text-primary-strong"}`}
                      >
                        <Icon name={inCart ? "check" : "plus"} />
                      </button>
                      <button type="button" onClick={() => setLeaving(p)} aria-label={`${t("viewInStore", lang)}: ${p.name[lang]}`} className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-2 text-muted">
                        <Icon name="external" className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </li>
          ))}
        </ul>
        {k < plan.steps.length && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setK(k + 1);
              setSelected(null);
            }}
          >
            {t("nextStep", lang)} · {k + 1} {plan.steps[k].title[lang]}
          </Button>
        )}
        <p className="text-xs text-muted">{t("deltaNote", lang)}</p>
      </main>
      <BottomBar>
        <Button className="w-full" disabled={cart.length === 0} onClick={() => cart[0] && setLeaving({ sku: cart[0] } as Product)}>
          <Icon name="bag" className="h-4 w-4" />
          {t("cart", lang)} <span className="num">{cart.length}</span> · {t("viewInStore", lang)}
        </Button>
        <p className="pt-1.5 text-center text-xs text-muted">{t("checkoutNote", lang)}</p>
      </BottomBar>

      <Sheet open={leaving !== null} onClose={() => setLeaving(null)} title={t("viewInStore", lang)}>
        <p className="text-[15px]">{t("storeConfirm", lang)}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setLeaving(null)}>
            {t("cancel", lang)}
          </Button>
          {leaving && (
            <Link
              href={storeUrl(leaving.sku)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setLeaving(null)}
              className="inline-flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-[var(--radius-button)] bg-primary px-5 font-bold text-on-primary"
            >
              {t("go", lang)}
              <Icon name="external" className="h-4 w-4" />
            </Link>
          )}
        </div>
      </Sheet>
    </Screen>
  );
}

export default function ShopPage() {
  return (
    <Suspense>
      <ShopInner />
    </Suspense>
  );
}
