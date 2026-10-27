import type { YouCamTransport } from "./client";
import { pollTask, YouCamTaskError, type PollOptions } from "./poll";
import type { MakeupVtoResults } from "./types";
import patternCatalog from "../catalog/patterns.json";

export const VTO_FEATURE = "makeup-vto";

/** Effect objects follow the Makeup VTO "Makeup Effect Schema" (version "1.0"). */
export interface Palette {
  color: string;
  colorIntensity?: number;
  texture?: string;
  [extra: string]: unknown;
}

export interface Effect {
  category: string;
  pattern?: { name?: string; type?: string; [extra: string]: unknown };
  shape?: { name: string };
  /** Live API keys (the prose example's innerRatio/featherStrength are rejected). */
  style?: { type: string; innerColorRatio?: number; blendStrength?: number };
  morphology?: { fullness?: number; wrinkless?: number };
  palettes?: Palette[];
  [extra: string]: unknown;
}

export const VTO_CATEGORIES = [
  "skin_smooth",
  "blush",
  "bronzer",
  "concealer",
  "contour",
  "eyebrows",
  "eye_liner",
  "eye_shadow",
  "eyelashes",
  "foundation",
  "highlighter",
  "lip_color",
  "lip_liner",
] as const;

type Catalog = { categories: Record<string, Array<{ label: string; colorNum?: number }>> };
const CATALOG = patternCatalog as Catalog;

/** Categories whose `pattern.name` must match a catalog label (and the catalog key holding it). */
const PATTERN_CATALOG_KEY: Record<string, string> = {
  blush: "blush",
  eye_shadow: "eye_shadow",
  eye_liner: "eye_liner",
  eyebrows: "eyebrows",
  contour: "contour",
  highlighter: "highlighter",
  lip_liner: "lip_liner",
};

/** palettes.length must equal colorNum for these (doc: "minItems: (see colorNum in pattern)", example: "requires exactly two"). */
const COLORNUM_CATEGORIES = new Set(["blush", "eye_shadow", "eye_liner"]);

const TEXTURES: Record<string, string[]> = {
  blush: ["matte", "satin", "shimmer"],
  eye_shadow: ["matte", "shimmer", "metallic"],
  eye_liner: ["matte", "shimmer", "metallic"],
  eyebrows: ["matte", "shimmer"],
  lip_color: ["matte", "gloss", "holographic", "metallic", "satin", "sheer", "shimmer"],
  lip_liner: ["matte", "satin"],
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function isPct(v: unknown) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100;
}

export function findPattern(category: string, label: string) {
  const key = PATTERN_CATALOG_KEY[category];
  return key ? CATALOG.categories[key]?.find((p) => p.label === label) : undefined;
}

/** Returns human-readable problems; an empty array means the effect matches the documented schema. */
export function validateEffect(e: Effect): string[] {
  const errs: string[] = [];
  const where = e.category;
  if (!(VTO_CATEGORIES as readonly string[]).includes(e.category)) return [`unknown category ${e.category}`];

  if (e.category === "skin_smooth") {
    for (const k of ["skinSmoothStrength", "skinSmoothColorIntensity"]) {
      if (e[k] !== undefined && !isPct(e[k])) errs.push(`${where}.${k} must be 0..100`);
    }
    return errs;
  }

  const palettes = e.palettes ?? [];
  if (palettes.length === 0) errs.push(`${where}: palettes required`);

  const catKey = PATTERN_CATALOG_KEY[e.category];
  if (catKey) {
    const isEyebrowColorOnly = e.category === "eyebrows" && e.pattern?.type === "color";
    if (!isEyebrowColorOnly) {
      const name = e.pattern?.name;
      const found = name ? findPattern(e.category, name) : undefined;
      if (!found) errs.push(`${where}: pattern.name "${name ?? ""}" is not a catalog label`);
      else if (COLORNUM_CATEGORIES.has(e.category) && found.colorNum !== undefined && palettes.length !== found.colorNum) {
        // Live: blush rejects a mismatch (invalid_parameter); eye_shadow tolerated one. We enforce it for all three.
        errs.push(`${where}: pattern ${name} needs ${found.colorNum} palettes, got ${palettes.length}`);
      }
      // Live (2026-10-27): shape brows need all three geometry keys even though the OpenAPI marks them optional.
      if (e.category === "eyebrows") {
        for (const k of ["curvature", "thickness", "definition"]) {
          const v = e.pattern?.[k];
          const min = k === "definition" ? 0 : -100;
          if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > 100) errs.push(`eyebrows: pattern.${k} required (${min}..100)`);
        }
      }
    }
  }

  if (e.category === "lip_color") {
    const shape = e.shape?.name ?? "original";
    if (!CATALOG.categories.lip_shape?.some((s) => s.label === shape)) errs.push(`lip_color: shape "${shape}" not in lipshape catalog`);
    if (e.style?.type === "ombre") {
      if (!isPct(e.style.innerColorRatio)) errs.push("lip_color: ombre needs innerColorRatio 0..100");
      if (!isPct(e.style.blendStrength)) errs.push("lip_color: ombre needs blendStrength 0..100");
      // Live (2026-10-27): one palette → "palettes length is insufficient".
      if (palettes.length < 2) errs.push("lip_color: ombre needs 2 palettes (outer, inner)");
    } else if (e.style && !["full", "ombre", "twoTone"].includes(e.style.type)) errs.push(`lip_color: bad style ${e.style.type}`);
  }

  palettes.forEach((p, i) => {
    const at = `${where}.palettes[${i}]`;
    if (!HEX.test(p.color)) errs.push(`${at}.color must be #RRGGBB`);
    if (p.colorIntensity !== undefined && !isPct(p.colorIntensity)) errs.push(`${at}.colorIntensity must be 0..100`);
    const tex = p.texture;
    const allowed = TEXTURES[e.category];
    if (tex !== undefined && allowed && !allowed.includes(tex)) errs.push(`${at}.texture ${tex} not allowed for ${where}`);
    const need = (keys: string[]) => keys.forEach((k) => p[k] === undefined && errs.push(`${at}.${k} required for texture ${tex}`));

    if (e.category === "blush") {
      if (tex === "satin") need(["glowStrength"]);
      if (tex === "shimmer") need(["shimmerColor", "shimmerDensity"]);
    }
    if (e.category === "eye_shadow" || e.category === "eye_liner") {
      if (tex === "shimmer" || tex === "metallic") need(["shimmerColor", "shimmerIntensity"]);
      if (tex === "metallic") need(["metallicIntensity"]);
    }
    if (e.category === "lip_color" && tex) {
      if (["gloss", "holographic", "metallic", "sheer", "shimmer"].includes(tex)) need(["gloss"]);
      if (["holographic", "metallic", "shimmer"].includes(tex)) need(["shimmerColor", "shimmerIntensity", "shimmerDensity", "shimmerSize"]);
      if (["gloss", "sheer", "shimmer"].includes(tex)) need(["transparencyIntensity"]);
    }
  });
  return errs;
}

export function validateEffects(effects: Effect[]): string[] {
  return effects.flatMap(validateEffect);
}

export function buildVtoRequest(fileId: string, effects: Effect[]) {
  return { src_file_id: fileId, effects, version: "1.0" };
}

/** Accepts both documented result shapes (`results.url` in the schema, `results[].download_url` in the prose). */
export function extractResultUrl(results: MakeupVtoResults): string {
  const first = Array.isArray(results) ? results[0] : results;
  const url = first?.url ?? first?.download_url;
  if (!url) throw new YouCamTaskError("missing_result_url", VTO_FEATURE);
  return url;
}

/** One VTO task = 1 unit. Returns the result image bytes; the presigned URL stays on the server. */
export async function runMakeupVto(
  transport: YouCamTransport,
  fileId: string,
  effects: Effect[],
  poll?: PollOptions,
): Promise<Uint8Array> {
  const problems = validateEffects(effects);
  if (problems.length) throw new YouCamTaskError(`invalid_effects: ${problems.join("; ")}`, VTO_FEATURE);
  const { data } = await transport.runTask(VTO_FEATURE, buildVtoRequest(fileId, effects));
  const results = await pollTask<MakeupVtoResults>(transport, VTO_FEATURE, data.task_id, poll);
  return transport.download(extractResultUrl(results));
}
