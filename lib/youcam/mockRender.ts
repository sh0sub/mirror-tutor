import sharp from "sharp";
import type { Effect } from "./makeupVto";
import { CATEGORY_REGION, REGIONS } from "../regions";

/**
 * Mock-mode stand-in for Makeup VTO: paints soft colored overlays on the user's own photo at the
 * fixed face regions, so UI work and tests run without spending units. It is visibly a mock
 * (flat blurred ellipses), never shown as a real VTO result in demo videos.
 */
export async function mockRenderEffects(source: Uint8Array, effects: Effect[]): Promise<Uint8Array> {
  const img = sharp(source);
  const { width = 600, height = 800 } = await img.metadata();
  const shapes: string[] = [];

  for (const e of effects) {
    const region = CATEGORY_REGION[e.category];
    if (!region || e.category === "skin_smooth") continue;
    const palettes = e.palettes ?? [];
    if (!palettes.length) continue;
    const boxes = REGIONS[region];
    boxes.forEach((b) => {
      palettes.forEach((p, i) => {
        // Multi-color patterns: spread colors horizontally across the box (inner → outer).
        const slice = b.w / palettes.length;
        const cx = (b.x + slice * (i + 0.5)) * width;
        const cy = (b.y + b.h / 2) * height;
        const rx = ((palettes.length > 1 ? slice : b.w) / 2) * width;
        const ry = (b.h / 2) * height;
        const intensity = typeof p.colorIntensity === "number" ? p.colorIntensity : 50;
        const opacity = (region === "base" ? 0.18 : 0.75) * (intensity / 100);
        shapes.push(
          `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${p.color}" fill-opacity="${opacity.toFixed(3)}"/>`,
        );
      });
    });
  }

  const blur = Math.max(2, Math.round(width / 120));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="b"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g filter="url(#b)">${shapes.join("")}</g></svg>`;
  const out = await img
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 88 })
    .toBuffer();
  return new Uint8Array(out);
}
