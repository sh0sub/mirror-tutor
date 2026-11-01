/**
 * C11: the monolid sample's "uncorrected" lesson. Face Analyzer read the monolid face (model-c) as Double-lid; if the
 * visitor keeps that reading, the lesson is the double-lid one. These are its 4 cumulative Makeup VTO steps on the
 * analyzer's raw profile (.local/demo-profiles.json, 0u: the analysis was already paid for in generate.ts), so the
 * sample trial can switch between the raw and the corrected lesson with real renders. Cost: 4 units (one task per step).
 *
 *   YOUCAM_MODE=live npx tsx scripts/demo/generate-raw.ts
 *
 * Files: public/demo/model-c/raw-step-N.jpg (same crop/size as step-N.jpg). Resumable: existing files are not re-rendered.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readConfig } from "../../lib/config";
import { createRuntime } from "../../lib/runtime";
import { totalCredit } from "../../lib/youcam/client";
import { renderLesson, type StepResult } from "../../lib/services/render";
import type { FaceProfile } from "../../lib/profile";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR = path.join(ROOT, "public/demo/model-c");
const CROP = { left: 0, top: 0, width: 1200, height: 1600 }; // same as model-c in generate.ts

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    /* no .env */
  }
  const cfg = readConfig();
  if (cfg.mode !== "live") throw new Error("not live, nothing was called");
  const raw = (JSON.parse(readFileSync(path.join(ROOT, ".local/demo-profiles.json"), "utf8")) as Record<string, { profile: FaceProfile }>)["model-c"].profile;
  console.log(`raw profile ${JSON.stringify(raw)}`);
  const src = readFileSync(path.join(ROOT, ".local/face3.jpg"));
  const srcMeta = await sharp(src).metadata();
  const rt = createRuntime(cfg);
  const before = totalCredit(await rt.transport.getCredit());
  const missing = [1, 2, 3, 4].filter((i) => !existsSync(path.join(DIR, `raw-step-${i}.jpg`)));
  const pending: Promise<void>[] = [];
  const failed: string[] = [];
  if (missing.length) {
    await renderLesson(
      rt,
      "demo-model-c-raw",
      { image: src, lessonId: "daily-k", profile: raw, steps: missing },
      (s: StepResult) => {
        if (s.status !== "done") return void failed.push(`step ${s.index}: ${s.status}`);
        const bytes = Buffer.from(s.image.split(",")[1], "base64");
        pending.push(
          (async () => {
            const meta = await sharp(bytes).metadata();
            const sx = meta.width! / srcMeta.width!;
            const sy = meta.height! / srcMeta.height!;
            const jpg = await sharp(bytes)
              .rotate()
              .extract({ left: Math.round(CROP.left * sx), top: Math.round(CROP.top * sy), width: Math.round(CROP.width * sx), height: Math.round(CROP.height * sy) })
              .resize(600, 800, { fit: "cover" })
              .jpeg({ quality: 85, mozjpeg: true })
              .toBuffer();
            writeFileSync(path.join(DIR, `raw-step-${s.index}.jpg`), jpg);
            console.log(`wrote raw-step-${s.index}.jpg`);
          })(),
        );
      },
      { timeoutMs: 90_000 },
    );
    await Promise.all(pending);
  }
  console.log(`balance before ${before}u, after ${totalCredit(await rt.transport.getCredit())}u`);
  if (failed.length) throw new Error(`${failed.join("; ")} - rerun to retry only the missing steps`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
