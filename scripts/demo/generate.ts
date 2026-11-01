/**
 * S2 (#18) "두 얼굴 비교" pre-generation. Runs ONCE offline with a real key; the app then plays the
 * files back from public/demo/ with 0 live units.
 *
 *   YOUCAM_MODE=live npx tsx scripts/demo/generate.ts [--lesson daily-k] [--only model-c]
 *
 * Per model: Face Analyzer (10u, skipped when the profile is already known from a fixture) →
 * the same lesson's 4 cumulative Makeup VTO steps on that model's own profile (4u) →
 * crop to 3:4, resize to 600×800, re-encode (EXIF/ICC stripped) → public/demo/<model>/.
 * Sources are free-license stock photos (Pexels) kept in .local/; only the processed copies are written.
 * Expected cost: model-a 4u (profile from fixtures/youcam/live/face-attr-analysis.run1.json) + model-b 14u
 * + model-c 14u (monolid face, added 2026-11-02; source and license in public/demo/model-c/SOURCE.md).
 * `--only <id>` processes one model and merges it into the existing compare.json (the others stay as they are).
 * Resumable: analyzed profiles are kept in .local/demo-profiles.json and step files that already exist
 * are not re-rendered, so a rerun after a timeout only pays for the missing steps.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readConfig } from "../../lib/config";
import { createRuntime } from "../../lib/runtime";
import { totalCredit } from "../../lib/youcam/client";
import { analyzeFace } from "../../lib/services/analyze";
import { renderLesson, type StepResult } from "../../lib/services/render";
import { buildLesson } from "../../lib/lessons";
import { normalizeFaceAttributes } from "../../lib/youcam/faceAnalyzer";
import type { FaceProfile, ProfileKey } from "../../lib/profile";
import type { FaceAttrResults } from "../../lib/youcam/types";
import type { CompareManifest, CompareModel } from "../../lib/demo/compare";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "public/demo");
const PROFILES = path.join(ROOT, ".local/demo-profiles.json");
type Known = Record<string, { profile: FaceProfile; source: Record<ProfileKey, string> }>;
const loadKnown = (): Known => (existsSync(PROFILES) ? (JSON.parse(readFileSync(PROFILES, "utf8")) as Known) : {});

interface ModelSpec {
  id: string;
  src: string;
  /** 3:4 crop around the face, in source pixels. */
  crop: { left: number; top: number; width: number; height: number };
  fixture?: string;
  /**
   * M2 correction applied on top of the analyzer's reading, exactly like a user fixing a misread on the
   * correction sheet. Recorded as `edited` in compare.json so the page can say the value was corrected.
   */
  edit?: Partial<FaceProfile>;
  credit: string;
}

const MODELS: ModelSpec[] = [
  { id: "model-a", src: ".local/face.jpg", crop: { left: 366, top: 0, width: 507, height: 676 }, fixture: "fixtures/youcam/live/face-attr-analysis.run1.json", credit: "Pexels stock photo (Pexels License, free for commercial use)" },
  { id: "model-b", src: ".local/face2.jpg", crop: { left: 100, top: 0, width: 1000, height: 1333 }, credit: "Pexels stock photo (Pexels License, free for commercial use)" },
  // .local/face3.jpg = Unsplash KRBHTbLTMDs (Peter John Manlapig) cropped to 3:4 around the face at 1200×1600 so it passes the quality gate.
  // Face Analyzer read this visibly monolid face as "Double-lid / Double-lid" (2026-11-02; a Pexels monolid face got the same
  // reading), so the eyelid is corrected on M2 the way a user would — the analyzer's raw label is kept in `source`.
  { id: "model-c", src: ".local/face3.jpg", crop: { left: 0, top: 0, width: 1200, height: 1600 }, edit: { eyelid: "monolid" }, credit: "Unsplash stock photo by Peter John Manlapig (Unsplash License, free for commercial use)" },
];

async function toDemoJpeg(input: Uint8Array | Buffer, spec: ModelSpec, srcSize: { width: number; height: number }) {
  const meta = await sharp(input).metadata();
  // VTO results may come back at a different size than the source; scale the crop box accordingly.
  const sx = (meta.width ?? srcSize.width) / srcSize.width;
  const sy = (meta.height ?? srcSize.height) / srcSize.height;
  const c = spec.crop;
  return sharp(input)
    .rotate()
    .extract({ left: Math.round(c.left * sx), top: Math.round(c.top * sy), width: Math.round(c.width * sx), height: Math.round(c.height * sy) })
    .resize(600, 800, { fit: "cover" })
    .jpeg({ quality: 85, mozjpeg: true }) // re-encode without withMetadata() → EXIF/GPS/ICC dropped
    .toBuffer();
}

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    /* no .env */
  }
  const cfg = readConfig();
  if (cfg.mode !== "live") throw new Error("not live (set YOUCAM_MODE=live and YOUCAM_API_KEY) — nothing was called");
  const li = process.argv.indexOf("--lesson");
  const lessonId = li > 0 ? process.argv[li + 1] : "daily-k";
  const oi = process.argv.indexOf("--only");
  const only = oi > 0 ? process.argv[oi + 1] : undefined;
  const rt = createRuntime(cfg);
  const models: CompareModel[] = [];
  let spent = 0;
  const balance = async () => totalCredit(await rt.transport.getCredit());
  console.log(`balance before: ${await balance()}u`);

  for (const spec of MODELS.filter((m) => !only || m.id === only)) {
    const src = readFileSync(path.join(ROOT, spec.src));
    const srcMeta = await sharp(src).metadata();
    const srcSize = { width: srcMeta.width!, height: srcMeta.height! };
    let profile: FaceProfile;
    let source: Record<ProfileKey, string>;
    const known = loadKnown()[spec.id];
    if (known) {
      ({ profile, source } = known);
      console.log(`${spec.id}: profile from .local/demo-profiles.json (0u)`);
    } else if (spec.fixture && existsSync(path.join(ROOT, spec.fixture))) {
      ({ profile, source } = normalizeFaceAttributes(JSON.parse(readFileSync(path.join(ROOT, spec.fixture), "utf8")) as FaceAttrResults));
      console.log(`${spec.id}: profile from fixture (0u)`);
    } else {
      const a = await analyzeFace(rt, `demo-${spec.id}`, src);
      if (!a.ok) throw new Error(`${spec.id}: analyze failed ${a.code}`);
      spent += a.units.spent;
      ({ profile, source } = a);
      writeFileSync(PROFILES, JSON.stringify({ ...loadKnown(), [spec.id]: { profile, source } }, null, 2));
      console.log(`${spec.id}: Face Analyzer ${a.units.spent}u`);
    }
    console.log(`${spec.id}: ${JSON.stringify(profile)} (eyelid raw: ${source.eyelid})`);
    const edited = spec.edit ? (Object.keys(spec.edit) as ProfileKey[]).filter((k) => spec.edit![k] !== profile[k]) : [];
    if (edited.length) {
      profile = { ...profile, ...spec.edit };
      console.log(`${spec.id}: M2 correction ${edited.map((k) => `${k}=${profile[k]}`).join(", ")} (analyzer raw kept in source)`);
    }

    const dir = path.join(OUT, spec.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "original.jpg"), await toDemoJpeg(src, spec, srcSize));
    const stepCount = buildLesson(lessonId, profile).steps.length;
    const files = Array.from({ length: stepCount }, (_, i) => `/demo/${spec.id}/step-${i + 1}.jpg`);
    const missing = files.flatMap((f, i) => (existsSync(path.join(ROOT, "public", f)) ? [] : [i + 1]));
    const failed: string[] = [];
    let r = { spent: 0 };
    if (missing.length) {
      // Save each step as soon as it arrives so a timeout on one step doesn't lose the others.
      const pending: Promise<void>[] = [];
      r = await renderLesson(
        rt,
        `demo-${spec.id}`,
        { image: src, lessonId, profile, steps: missing },
        (s: StepResult) => {
          if (s.status !== "done") return void failed.push(`step ${s.index}: ${s.status} ${s.code}`);
          pending.push(toDemoJpeg(Buffer.from(s.image.split(",")[1], "base64"), spec, srcSize).then((b) => writeFileSync(path.join(ROOT, "public", files[s.index - 1]), b)));
        },
        { timeoutMs: 90_000 },
      );
      await Promise.all(pending);
      spent += r.spent;
    }
    console.log(`${spec.id}: rendered ${missing.length ? missing.join(",") : "none (all cached on disk)"} · ${r.spent}u`);
    if (failed.length) throw new Error(`${spec.id}: ${failed.join("; ")} — rerun to retry only the missing steps`);
    models.push({ id: spec.id, profile, source, ...(edited.length ? { edited } : {}), original: `/demo/${spec.id}/original.jpg`, steps: files, credit: spec.credit });
  }

  const prev = only && existsSync(path.join(OUT, "compare.json")) ? (JSON.parse(readFileSync(path.join(OUT, "compare.json"), "utf8")) as CompareManifest) : undefined;
  const merged = prev ? [...prev.models.filter((m) => m.id !== only), ...models] : models;
  const manifest: CompareManifest = { lessonId, generatedAt: new Date().toLocaleDateString("sv-SE"), models: merged };
  writeFileSync(path.join(OUT, "compare.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote public/demo/compare.json · spent ${spent}u · balance after: ${await balance()}u`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
