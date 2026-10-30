import data from "./shades.json";
import { deltaE2000, hexToLab, type Lab } from "../color";
import type { Text } from "../rules/engine";

/** Personalized base color: measured skin tone → one fixed foundation shade (0 units, data in shades.json). */
export interface Shade {
  id: string;
  name: Text;
  hex: string;
  blushDelta: number;
}

export const SHADES = data.shades as Shade[];
export const DEFAULT_SHADE_ID = data.defaultId;

/**
 * A selfie reads darker than a swatch of the same skin (exposure, the cheek's curve turning away from the
 * light), so the measured L* is lifted this much before matching. Tuned on the two demo photos; approximate.
 */
export const PHOTO_L_LIFT = 5;

export function getShade(id: string): Shade | undefined {
  return SHADES.find((s) => s.id === id);
}

/** Strict: only a ladder id (e.g. "23N") is accepted from the client — never a free hex. */
export function parseShadeId(raw: unknown): string | null {
  return typeof raw === "string" && SHADES.some((s) => s.id === raw) ? raw : null;
}

/** Nearest ladder shade by CIEDE2000 to the measured skin Lab (after the photo lift). */
export function nearestShade(lab: Lab): { shade: Shade; deltaE: number } {
  const q: Lab = [Math.min(100, lab[0] + PHOTO_L_LIFT), lab[1], lab[2]];
  return SHADES.map((shade) => ({ shade, deltaE: Math.round(deltaE2000(q, hexToLab(shade.hex)) * 10) / 10 })).sort((a, b) => a.deltaE - b.deltaE)[0];
}
