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
