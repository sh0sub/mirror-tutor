/**
 * C9 simulated sample attempt (0 YouCam units, no network except the public MediaPipe CDN files).
 *
 *   npx tsx scripts/demo/make-sample-attempt.ts
 *
 * The sample grading screen used to compare the lesson answer with the step-3 image, so three of four regions were
 * pixel-identical (score 100) and looked scripted. This writes public/demo/model-a/sample-attempt.jpg: the answer
 * (step 4) with a deterministic CIELAB shift inside each graded landmark polygon, so every region is visibly a little
 * off, like a real first try. Same face, same pixels outside the four regions; the app labels it "simulated".
 * The face landmarks come from MediaPipe in headless Chrome (the same model the app grades with).
 *
 * C11: also for the monolid sample.  npx tsx scripts/demo/make-sample-attempt.ts model-c
 * writes model-c/sample-attempt.jpg (from step-4.jpg, the corrected lesson) and model-c/sample-attempt-raw.jpg (from
 * raw-step-4.jpg, the lesson on the analyzer's uncorrected reading), same shifts, same face landmarks.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { labToRgb, rgbToLab, type Lab } from "../../lib/color";
import { landmarkMeasure, regionPolygons, type Pt } from "../../lib/grade/landmarks";
import { GRADE_REGIONS, type GradeRegion } from "../../lib/regions";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MODEL = process.argv[2] ?? "model-a";
const DIR = path.join(ROOT, "public/demo", MODEL);
/** [source answer image, attempt file] pairs per model. */
const JOBS: Record<string, Array<[string, string]>> = {
  "model-a": [["step-4.jpg", "sample-attempt.jpg"]],
  "model-c": [
    ["step-4.jpg", "sample-attempt.jpg"],
    ["raw-step-4.jpg", "sample-attempt-raw.jpg"],
  ],
};
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WORK_WIDTH = 480;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lab shifts (dL, da, db) applied inside each region, chosen so the sample reads as a plausible first attempt. */
export const SHIFTS: Record<GradeRegion, Lab> = {
  eye_line: [7, 0.4, 1.2], // liner too faint
  eye_lid: [-3.5, 4.6, 3], // shadow a little deep and pink
  cheek: [2.8, 2.4, 1.6], // base a touch light
  lip: [4.8, -8.6, 7.7], // lip color lighter and more orange than the answer
};

const PAGE = `<!doctype html><meta charset=utf-8><img id=i src="/step-4.jpg"><script type=module>
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/vision_bundle.mjs";
try {
  const img = document.getElementById("i"); await img.decode();
  const fs = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm");
  const lm = await FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1 });
  const c = document.createElement("canvas"); c.width = ${WORK_WIDTH}; c.height = Math.round(${WORK_WIDTH} * img.naturalHeight / img.naturalWidth);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  window.__out = JSON.stringify(lm.detect(c).faceLandmarks[0] ?? null);
} catch (e) { window.__out = "ERR " + e; }
</script>`;

async function landmarksFromChrome(): Promise<Pt[]> {
  const server = createServer((req, res) => {
    if (req.url === "/") res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    else if (req.url === "/step-4.jpg") res.writeHead(200, { "content-type": "image/jpeg" }).end(readFileSync(path.join(DIR, "step-4.jpg")));
    else res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const httpPort = (server.address() as { port: number }).port;
  const port = 9800 + Math.floor(Math.random() * 100);
  const profile = mkdtempSync(path.join(tmpdir(), "mt-lm-"));
  const proc = spawn(CHROME, ["--headless=new", "--mute-audio", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `http://127.0.0.1:${httpPort}/`], { stdio: "ignore" });
  try {
    let wsUrl: string | undefined;
    for (let i = 0; i < 100 && !wsUrl; i++) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
        wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
      } catch {
        /* not up yet */
      }
      if (!wsUrl) await sleep(200);
    }
    if (!wsUrl) throw new Error("Chrome did not start");
    const sock = new WebSocket(wsUrl);
    await new Promise((r, j) => ((sock.onopen = r), (sock.onerror = j)));
    let id = 0;
    const waiting = new Map<number, (v: { result?: { result?: { value?: unknown } } }) => void>();
    sock.onmessage = (m) => {
      const d = JSON.parse(String(m.data));
      waiting.get(d.id)?.(d);
    };
    const evalJs = (expression: string) =>
      new Promise<unknown>((resolve) => {
        const n = ++id;
        waiting.set(n, (d) => resolve(d.result?.result?.value));
        sock.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
      });
    for (let i = 0; i < 150; i++) {
      const v = await evalJs("window.__out");
      if (typeof v === "string") {
        if (v.startsWith("ERR") || v === "null") throw new Error(`landmarker: ${v}`);
        return JSON.parse(v) as Pt[];
      }
      await sleep(400);
    }
    throw new Error("landmarker timeout");
  } finally {
    proc.kill("SIGKILL");
    server.close();
  }
}

async function main() {
  // The detection is cached in scripts/demo/model-a-landmarks.json (normalized points of step-4.jpg; unit-tested). Delete it to re-detect in Chrome.
  const cache = process.env.MT_LANDMARKS_CACHE ?? path.join(import.meta.dirname, `${MODEL}-landmarks.json`);
  let lm: Pt[];
  if (cache && existsSync(cache)) lm = JSON.parse(readFileSync(cache, "utf8")) as Pt[];
  else {
    lm = await landmarksFromChrome();
    if (cache) writeFileSync(cache, JSON.stringify(lm));
  }
  for (const [srcFile, destFile] of JOBS[MODEL]) {
    const { data, info } = await sharp(path.join(DIR, srcFile)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const out = Buffer.from(data);
    for (const region of GRADE_REGIONS) {
      const polys = regionPolygons(lm, region, w, h);
      const d = polys.map((p) => [p.outer, ...(p.holes ?? [])].map((ring) => `M${ring.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join("L")}Z`).join("")).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="black"/><path d="${d}" fill="white" fill-rule="evenodd"/></svg>`;
      const mask = await sharp(Buffer.from(svg)).blur(1.2).greyscale().raw().toBuffer();
      const [dl, da, db] = SHIFTS[region];
      for (let i = 0; i < w * h; i++) {
        const m = mask[i] / 255;
        if (m < 0.01) continue;
        const lab = rgbToLab(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
        const rgb = labToRgb([lab[0] + dl * m, lab[1] + da * m, lab[2] + db * m]);
        out[i * 3] = Math.max(0, Math.min(255, Math.round(rgb[0])));
        out[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(rgb[1])));
        out[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(rgb[2])));
      }
    }
    const dest = path.join(DIR, destFile);
    await sharp(out, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toFile(dest);
    // Self-check at the app's working width: the same landmark measure the browser runs.
    const prep = async (src: string | Buffer) => {
      const r = await sharp(src).resize({ width: WORK_WIDTH }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data: new Uint8Array(r.data), width: r.info.width, height: r.info.height };
    };
    const m = landmarkMeasure(await prep(path.join(DIR, srcFile)), lm, await prep(dest), lm);
    console.log(JSON.stringify(m?.regions.map((r) => ({ region: r.region, deltaE: r.deltaE, score: Math.round(100 - r.deltaE * 4) }))));
  }
}
void main();
