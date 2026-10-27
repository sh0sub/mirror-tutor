import catalog from "./catalog/products.json";
import { deltaEHex } from "./color";
import type { Effect } from "./youcam/makeupVto";
import type { Text } from "./rules/engine";

export interface Product {
  sku: string;
  category: string;
  name: Text;
  shades: string[];
  texture: string | null;
  priceKrw: number;
  priceUsd: number;
}

export const PRODUCTS = catalog.products as Product[];
export const MATCH_THRESHOLD = 5; // plan M6: "ΔE 5 이내"
export const INVISIBLE_DELTA = 3; // ΔE ≤ 3 ≈ indistinguishable by eye

/** Where "스토어에서 보기" goes. Demo placeholder; replace with the partner store URL. Checkout is not implemented. */
export function storeUrl(sku: string): string {
  return `https://example.com/mt-select/${encodeURIComponent(sku)}`;
}

export interface ProductMatch {
  product: Product;
  /** Mean CIEDE2000 between the step colors and the product shades (best pairing in order). */
  deltaE: number;
  textureMatch: boolean;
}

export interface EffectMatch {
  category: string;
  colors: string[];
  texture?: string;
  matches: ProductMatch[];
  /** No product within ΔE 5 → the UI shows "가장 가까운 색 2개". */
  noCloseMatch: boolean;
}

function score(colors: string[], p: Product): number {
  if (p.shades.length === colors.length) {
    return colors.reduce((s, c, i) => s + deltaEHex(c, p.shades[i]), 0) / colors.length;
  }
  // different shade counts: each color to its nearest shade
  return colors.reduce((s, c) => s + Math.min(...p.shades.map((h) => deltaEHex(c, h))), 0) / colors.length;
}

/** F7: match one VTO effect (hex + texture) to catalog products — nearest ΔE, same texture first. */
export function matchEffect(e: Effect, products: Product[] = PRODUCTS): EffectMatch {
  const colors = (e.palettes ?? []).map((p) => p.color.toUpperCase());
  const texture = e.palettes?.[0]?.texture;
  const ranked = products
    .filter((p) => p.category === e.category)
    .map((p) => ({ product: p, deltaE: Math.round(score(colors, p) * 10) / 10, textureMatch: !texture || !p.texture || p.texture === texture }))
    .sort((a, b) => Number(b.textureMatch) - Number(a.textureMatch) || a.deltaE - b.deltaE);
  const close = ranked.filter((m) => m.deltaE <= MATCH_THRESHOLD);
  if (close.length) return { category: e.category, colors, texture, matches: close.slice(0, 3), noCloseMatch: false };
  return {
    category: e.category,
    colors,
    texture,
    matches: [...ranked].sort((a, b) => a.deltaE - b.deltaE).slice(0, 2),
    noCloseMatch: true,
  };
}

export function matchStepEffects(effects: Effect[]): EffectMatch[] {
  return effects.filter((e) => e.category !== "skin_smooth").map((e) => matchEffect(e));
}
