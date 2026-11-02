import { buildLesson, type PlannedStep } from "./lessons";
import { matchEffect, PRODUCTS, MATCH_THRESHOLD, type Product } from "./shop";
import { PARTNER_SKU } from "./partner";
import type { FaceProfile } from "./profile";

/** The /embed/lesson widget a retailer drops into a product page with an iframe (data: the sample model's pre-generated lesson, 0 units). */
export const EMBED_LESSON = "daily-k";

/** The catalog product the widget features: ?sku= when it exists in the feed, else the demo SKU. Unknown SKUs never break the widget. */
export function embedProduct(sku: string | null | undefined): Product {
  return PRODUCTS.find((p) => p.sku === sku) ?? PRODUCTS.find((p) => p.sku === PARTNER_SKU)!;
}

export const EMBED_NAME_MAX = 40;
const HEX_PARAM = /^#?([0-9a-f]{6})$/i;
const DEFAULT_SHADE_NAME = { ko: "내 상품 셰이드", en: "Your shade" };

export interface CustomShade {
  /** Upper-case #RRGGBB. */
  hex: string;
  name: string;
}

/** Validate ?hex= (6 hex digits, # optional) and ?name= (control characters stripped, capped). Anything else returns null, so a bad query falls back to the catalog. */
export function parseCustomShade(hex: string | null | undefined, name?: string | null): CustomShade | null {
  const m = HEX_PARAM.exec((hex ?? "").trim());
  if (!m) return null;
  const clean = (name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, EMBED_NAME_MAX).trim();
  return { hex: `#${m[1].toUpperCase()}`, name: clean };
}

/** A retailer's own lip shade as a one-off product (no catalog entry, no prices, no YouCam call). Rendered as text by React, never as HTML. */
export function customProduct(shade: CustomShade): Product {
  const name = shade.name ? { ko: shade.name, en: shade.name } : DEFAULT_SHADE_NAME;
  return { sku: "CUSTOM", category: "lip_color", name, shades: [shade.hex], texture: null, priceKrw: 0, priceUsd: 0 };
}

/** Featured product for the widget query: a valid ?hex= wins (demo of the retailer's own shade), else ?sku=, else the demo SKU. */
export function embedProductFromQuery(q: { sku?: string | null; hex?: string | null; name?: string | null }): Product {
  const shade = parseCustomShade(q.hex, q.name);
  return shade ? customProduct(shade) : embedProduct(q.sku);
}

/** The lesson step whose effects use the featured product's category (a lip SKU opens on the lip step). Falls back to the last step. */
export function embedFocusStep(profile: FaceProfile, product: Product): number {
  const plan = buildLesson(EMBED_LESSON, profile);
  return plan.steps.find((s) => s.effects.some((e) => e.category === product.category))?.index ?? plan.steps.length;
}

export interface EmbedMatch {
  category: string;
  /** Lesson color for this effect. */
  hex: string;
  /** The product shown for it: the featured SKU when it is the same category, else the closest catalog product. */
  product: Product;
  deltaE: number;
  featured: boolean;
  /** Within the CIEDE2000 <= 5 match threshold. */
  close: boolean;
}

/** One CIEDE2000-matched product for a lesson step (the step's first non-smoothing effect), preferring the featured SKU in its own category. */
export function embedMatch(step: PlannedStep, featured: Product): EmbedMatch | null {
  const effect = step.effects.find((e) => e.category !== "skin_smooth");
  if (!effect) return null;
  const pool = effect.category === featured.category ? [featured] : PRODUCTS;
  const m = matchEffect(effect, pool);
  const top = m.matches[0];
  if (!top) return null;
  return { category: effect.category, hex: m.colors[0], product: top.product, deltaE: top.deltaE, featured: pool.length === 1, close: top.deltaE <= MATCH_THRESHOLD };
}
