/**
 * C18: writes public/demo/eye-overlay.json (lid band, crease guide and gradient arrows per compare model) from the cached
 * MediaPipe landmarks scripts/demo/<model>-landmarks.json (normalized to the 600x800 photos). Deterministic; tests re-derive it.
 * Usage: npx tsx scripts/demo/make-eye-overlay.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eyeOverlayFromLandmarks } from "../../lib/eyeOverlay";

const here = import.meta.dirname;
const out: Record<string, unknown> = {};
for (const id of ["model-a", "model-c"]) {
  const lm = JSON.parse(readFileSync(path.join(here, `${id}-landmarks.json`), "utf8")) as { x: number; y: number }[];
  const o = eyeOverlayFromLandmarks(lm);
  if (!o) throw new Error(`${id}: incomplete landmarks`);
  out[id] = o;
}
writeFileSync(path.join(here, "../../public/demo/eye-overlay.json"), JSON.stringify(out) + "\n");
console.log("wrote public/demo/eye-overlay.json", Object.keys(out));
