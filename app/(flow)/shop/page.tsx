"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppBar, BottomBar, Button, Chip, Icon, ModeBanner, Screen, Sheet, Swatch } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t, tf } from "@/lib/i18n";
import { buildLesson, getLesson } from "@/lib/lessons";
import { INVISIBLE_DELTA, matchStepEffects, PRODUCTS, storeUrl, type Product } from "@/lib/shop";
import { ProductArt } from "@/components/ProductArt";
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

  // keep the highlighted region (or the eyes) centered in the visible strip of the answer image
  const focusY = boxes.length ? boxes.reduce((a, b) => a + b.y + b.h / 2, 0) / boxes.length : 0.4;

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
      <main className="flex flex-1 flex-col">
        {/* answer image behind the sheet; cover-fit with the face kept in view, so the overlay shares the image's box */}
        <div className="relative h-[30dvh] flex-none overflow-hidden bg-panel-2 [container-type:inline-size]">
          <div className="absolute inset-x-0 aspect-[3/4]" style={{ top: `max(calc(30dvh - 133.333cqw), min(0px, calc(15dvh - ${focusY.toFixed(3)} * 133.333cqw)))` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- in-memory image */}
            {answer && <img src={answer} alt={`${t("answer", lang)} · ${k}`} className="h-full w-full object-cover" />}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {boxes.map((b, i) => (
                <rect key={i} x={b.x * 100 - 2} y={b.y * 100 - 2} width={b.w * 100 + 4} height={b.h * 100 + 4} rx="3" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="0.8" />
              ))}
            </svg>
          </div>
        </div>

        <div className="relative z-[1] -mt-5 flex min-h-[70dvh] flex-1 flex-col gap-4 rounded-t-[var(--radius-sheet)] bg-panel px-4 pb-6 pt-3 shadow-[0_-8px_24px_rgba(31,27,26,0.12)]">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="text-lg font-extrabold">{t("shopTitle", lang)}</h2>

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
                  <article key={p.sku} className="flex items-center gap-3 rounded-[var(--radius-panel)] bg-panel-2 p-3">
                    <div className="relative flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-xl bg-panel" aria-hidden>
                      <ProductArt category={p.category} shades={p.shades} texture={p.texture} className="h-[72px] w-[72px]" />
                      <span className="absolute bottom-1 right-1 flex gap-0.5">
                        {p.shades.map((h) => (
                          <span key={h} className="h-2.5 w-2.5 rounded-full border border-canvas" style={{ background: h }} />
                        ))}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold leading-snug">{p.name[lang]}</h3>
                      <p className="num text-xs text-muted">{p.shades.join(" / ")}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Chip tone={deltaE <= INVISIBLE_DELTA ? "ok" : "neutral"} icon={deltaE <= INVISIBLE_DELTA ? "check" : undefined}>
                          <span className="num">ΔE {deltaE.toFixed(1)}</span>
                        </Chip>
                        {!textureMatch && <Chip tone="warn">{t("textureMismatch", lang)}</Chip>}
                        <span className="num text-sm font-bold">
                          ₩{p.priceKrw.toLocaleString("ko-KR")} <span className="font-normal text-muted">· ${p.priceUsd}</span>
                        </span>
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
        </div>
      </main>
      <BottomBar>
        <Button className="w-full" disabled={cart.length === 0} onClick={() => cart[0] && setLeaving({ sku: cart[0] } as Product)}>
          <Icon name="bag" className="h-4 w-4" />
          {t("cart", lang)} <span className="num">{cart.length}</span> · {t("viewInStore", lang)}
        </Button>
        <p className="pt-1.5 text-center text-xs text-muted">{t("checkoutNote", lang)}</p>
      </BottomBar>

      <Sheet open={leaving !== null} onClose={() => setLeaving(null)} title={t("viewInStore", lang)}>
        {(() => {
          const lp = leaving ? PRODUCTS.find((x) => x.sku === leaving.sku) : undefined;
          return (
            lp && (
              <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-panel)] bg-panel-2 p-3">
                <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-panel" aria-hidden>
                  <ProductArt category={lp.category} shades={lp.shades} texture={lp.texture} className="h-[72px] w-[72px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{lp.name[lang]}</p>
                  <p className="num text-xs text-muted">{lp.shades.join(" / ")}</p>
                  <p className="num text-sm font-bold">
                    ₩{lp.priceKrw.toLocaleString("ko-KR")} <span className="font-normal text-muted">· ${lp.priceUsd}</span>
                  </p>
                </div>
              </div>
            )
          );
        })()}
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
