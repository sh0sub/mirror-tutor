/**
 * S4 (#20) live check: re-render ONE lesson step at +20% through the real app path
 * (renderLesson → upload (free) → 1 Makeup VTO task = 1u). Output image stays in .local/ (face-derived).
 *
 *   YOUCAM_MODE=live npx tsx scripts/spike/intensity.ts [image=.local/face.jpg] [step=2] [scale=1.2]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readConfig } from "../../lib/config";
import { createRuntime } from "../../lib/runtime";
import { renderLesson, type StepResult } from "../../lib/services/render";
import { parseStepScales } from "../../lib/lessons";
import type { FaceProfile } from "../../lib/profile";

const ROOT = path.resolve(import.meta.dirname, "../..");

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    /* no .env */
  }
  const cfg = readConfig();
  if (cfg.mode !== "live") throw new Error("not live (set YOUCAM_MODE=live and YOUCAM_API_KEY) — nothing was called");
  const [imgArg = ".local/face.jpg", stepArg = "2", scaleArg = "1.2"] = process.argv.slice(2);
  const step = Number(stepArg);
  const stepScales = parseStepScales({ [step]: Number(scaleArg) });
  if (!stepScales[step]) throw new Error("scale must be 0.8 or 1.2");
  // face.jpg profile from the D1 spike (fixtures/youcam/live/face-attr-analysis.run1.json)
  const profile: FaceProfile = { eyelid: "double", eyeShape: "almond", lipShape: "average", faceShape: "triangle", eyebrowShape: "rounded" };
  const rt = createRuntime(cfg);
  const before = await rt.guard.status("spike");
  const t0 = Date.now();
  const out: StepResult[] = [];
  const summary = await renderLesson(rt, "spike", { image: readFileSync(path.join(ROOT, imgArg)), lessonId: "daily-k", profile, steps: [step], build: { stepScales } }, (r) => out.push(r));
  const ms = Date.now() - t0;
  for (const r of out) {
    if (r.status === "done") {
      const file = path.join(ROOT, `.local/s4-step${step}-x${scaleArg}.jpg`);
      writeFileSync(file, Buffer.from(r.image.split(",")[1], "base64"));
      console.log(`step ${r.index}: done in ${(ms / 1000).toFixed(1)}s → ${path.relative(ROOT, file)}`);
    } else console.log(`step ${r.index}: ${r.status} ${r.code}`);
  }
  console.log(`spent ${summary.spent}u · credit before ${before.remaining ?? "?"} → after ${summary.units.remaining ?? "?"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
