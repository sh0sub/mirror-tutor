/**
 * Spike #1 (0 units, no API key): download the public Makeup VTO pattern catalogs and write a
 * condensed copy to lib/catalog/patterns.json. `pattern.name` must equal a catalog `label`, and for
 * blush/eye_shadow/eye_liner the palette count must equal `colorNum` (Makeup VTO OpenAPI description).
 *
 *   npm run catalog:fetch
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE = "https://plugins-media.makeupar.com/wcm-saas";
const SOURCES = {
  eye_shadow: `${BASE}/patterns/eyeshadow.json`,
  eye_liner: `${BASE}/patterns/eyeliner.json`,
  blush: `${BASE}/patterns/blush.json`,
  eyebrows: `${BASE}/patterns/eyebrows.json`,
  contour: `${BASE}/patterns/contour.json`,
  highlighter: `${BASE}/patterns/highlighter.json`,
  lip_liner: `${BASE}/patterns/lipliner.json`,
  lip_shape: `${BASE}/shapes/lipshape.json`,
} as const;

interface RawPattern {
  label: string;
  category?: string;
  colorNum?: number;
  tags?: Array<{ name: string }>;
  style?: string;
  shape?: string;
}

export interface CondensedPattern {
  label: string;
  colorNum?: number;
  tags?: string[];
}

export async function fetchCatalog(fetchImpl: typeof fetch = fetch) {
  const categories: Record<string, CondensedPattern[]> = {};
  for (const [cat, url] of Object.entries(SOURCES)) {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`${cat}: HTTP ${res.status}`);
    const list = (await res.json()) as RawPattern[];
    categories[cat] = list.map((p) => {
      const out: CondensedPattern = { label: p.label };
      if (typeof p.colorNum === "number") out.colorNum = p.colorNum;
      const tags = [...(p.tags ?? []).map((t) => t.name), ...(p.style ? [p.style] : []), ...(p.shape ? [p.shape] : [])];
      if (tags.length) out.tags = tags;
      return out;
    });
  }
  return { fetchedAt: new Date().toISOString(), source: BASE, categories };
}

async function main() {
  const catalog = await fetchCatalog();
  const out = fileURLToPath(new URL("../../lib/catalog/patterns.json", import.meta.url));
  await writeFile(out, JSON.stringify(catalog) + "\n");
  const counts = Object.fromEntries(Object.entries(catalog.categories).map(([k, v]) => [k, v.length]));
  console.log("wrote lib/catalog/patterns.json", counts);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
