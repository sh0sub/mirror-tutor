/**
 * C7: one extra pre-generated render for /compare: the monolid face (model-c) with the generic-tutorial technique,
 * i.e. the double-lid rule's shadow pattern (2colors3, shading that stacks up from the lash line) instead of the
 * monolid rule's pattern (2colors1). Everything else in step 3 (base, brows, colors, liner Upper6) is identical, so
 * only the shadow pattern differs. Cost: 1 Makeup VTO unit (cumulative step 3 = one task).
 *
 * The result is referenced from public/demo/compare.json (model-c.gradientPair); generate.ts does not rewrite that field.
 *
 *   YOUCAM_MODE=live npx tsx scripts/demo/generate-vertical.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readConfig } from "../../lib/config";
import { createRuntime } from "../../lib/runtime";
import { totalCredit } from "../../lib/youcam/client";
import { sanitizeImage } from "../../lib/privacy/sanitize";
import { uploadImage } from "../../lib/youcam/file";
import { runMakeupVto } from "../../lib/youcam/makeupVto";
import { buildLesson } from "../../lib/lessons";
import type { CompareManifest } from "../../lib/demo/compare";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR = path.join(ROOT, "public/demo/model-c");
/** [file, eye-shadow pattern]. Shadow intensity is raised to 100 in both so the pattern difference is visible at 600 px (at the lesson's 50 it is subtle). */
const TARGETS: Array<[string, string]> = [
  ["eye-horizontal.jpg", "2colors1"],
  ["eye-vertical.jpg", "2colors3"],
];
const SHADOW_INTENSITY = 100;
const CROP = { left: 0, top: 0, width: 1200, height: 1600 }; // same as model-c in generate.ts

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    /* no .env */
  }
  const cfg = readConfig();
  if (cfg.mode !== "live") throw new Error("not live, nothing was called");
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "public/demo/compare.json"), "utf8")) as CompareManifest;
  const model = manifest.models.find((m) => m.id === "model-c")!;
  const src = readFileSync(path.join(ROOT, ".local/face3.jpg"));
  const srcMeta = await sharp(src).metadata();
  const rt = createRuntime(cfg);
  const before = totalCredit(await rt.transport.getCredit());
  const plan = buildLesson(manifest.lessonId, model.profile); // same call generate.ts made for model-c
  const image = (await sanitizeImage(src)).bytes;
  const fileId = await uploadImage(rt.transport, image); // upload is free
  for (const [file, pattern] of TARGETS) {
    const out = path.join(DIR, file);
    if (existsSync(out)) continue;
    const effects = plan.steps[2].cumulativeEffects.map((e) =>
      e.category === "eye_shadow" ? { ...e, pattern: { ...e.pattern, name: pattern }, palettes: e.palettes?.map((p) => ({ ...p, colorIntensity: SHADOW_INTENSITY })) } : e,
    );
    const bytes = await runMakeupVto(rt.transport, fileId, effects, { timeoutMs: 90_000 }); // 1 task = 1 unit
    const c = CROP;
    const meta = await sharp(bytes).metadata();
    const sx = meta.width! / srcMeta.width!;
    const sy = meta.height! / srcMeta.height!;
    const jpg = await sharp(bytes)
      .rotate()
      .extract({ left: Math.round(c.left * sx), top: Math.round(c.top * sy), width: Math.round(c.width * sx), height: Math.round(c.height * sy) })
      .resize(600, 800, { fit: "cover" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    writeFileSync(out, jpg);
    console.log(`wrote ${file} (${pattern})`);
  }
  console.log(`balance before ${before}u, after ${totalCredit(await rt.transport.getCredit())}u`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
