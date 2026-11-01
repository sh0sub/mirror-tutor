#!/usr/bin/env node
/**
 * Re-composite the demo video from an earlier recording (0 YouCam units, no dev server, no live run).
 *
 *   node scripts/demo/recomposite.mjs --src <work dir of record-video.mjs> --work <scratch dir> --out <mp4>
 *
 * Reads the phone-frame timelines saved by record-video.mjs (`<src>/segments/<id>-phone.txt` + `<src>/frames`),
 * re-narrates (macOS `say`, written to files only), and lays each shot out as:
 *   left   = heading, chip and a per-line callout
 *   middle = the phone (462x1000)
 *   right  = a 1.85x zoom of the key region of the same phone frames, plus the subtitle underneath
 * Each segment edits the source timeline with `timeline` anchors (play a source range, or hold one frame),
 * which is how the dark "camera unavailable" shots are shortened. Needs Google Chrome, ffmpeg/ffprobe, `say`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"]] : acc), []),
);
if (!args.src || !args.work || !args.out) {
  console.error("usage: recomposite.mjs --src <record-video work dir> --work <scratch dir> --out <mp4> [--stills n] [--only id,id]");
  process.exit(2);
}
const SRC = path.resolve(args.src);
const WORK = path.resolve(args.work);
const OUT = path.resolve(args.out);
const STILLS = Number(args.stills ?? 0);
const ONLY = args.only ? String(args.only).split(",") : null;
const VOICE = args.voice ?? "Samantha";
const RATE = Number(args.rate ?? 150);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";
const FFPROBE = existsSync("/opt/homebrew/bin/ffprobe") ? "/opt/homebrew/bin/ffprobe" : "ffprobe";

const W = 1920, H = 1080, FPS = 30;
const SCR_W = 462, SCR_H = 1000, SCR_X = 600, SCR_Y = 40;
const ZX = 1110, ZY = 40, ZW = 750, ZH = 666; // zoom panel
const CSS_W = 390, CSS_H = 844, FR = 1; // saved screencast frames are 390x844 (1 px per css px)
const ZOOM_CSS_H = Math.round((CSS_W * ZH) / ZW); // visible css height in the zoom panel
const LEAD = 0.5, GAP = 0.35, TAIL = 0.9, ZOOM_MOVE = 0.7;

const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).toString();
const probe = (f) => Number(run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const log = (...a) => console.log("[recomp]", ...a);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ── shot list ───────────────────────────────────────────────────────────────
 * lines[i]      narration + subtitle i
 * ui[i]         per-line left-column override { heading?, chip?, callout? } (callout = HTML)
 * timeline      [{ at, src }]: from `at` (seconds | { cue, plus }) play source time `src` (number = hold, [a,b] = play a..b)
 * zoom          [{ at, y, x? }]: css-pixel top (and left) of the zoom window from `at` on, eased in over 0.7 s
 */
const SEGMENTS = [
  {
    id: "intro",
    kicker: "The problem",
    heading: "Tutorials fit someone else's eyes",
    chip: "YouCam AI Face Analyzer + Makeup Virtual Try-On",
    lines: [
      "If you have monolids, makeup tutorials filmed on someone else's eyes don't fit you.",
      "Mirror Tutor teaches makeup on your own face.",
      "YouCam's Face Analyzer reads your features, a rule table picks the technique, and Makeup Virtual Try-On renders every step on your photo as the answer key.",
    ],
    ui: [
      { heading: "Monolid? Double lid? The technique is different.", callout: "A tutorial filmed on someone else's eyes never says what to change for <b>your</b> eyelid." },
      { heading: "Makeup lessons on your own face", callout: "One selfie in, a lesson built on <b>your</b> face out." },
      { heading: "Makeup lessons on your own face", callout: "<b>Face Analyzer</b> reads features<br><b>Rule table</b> picks the technique<br><b>Makeup VTO</b> renders each step" },
    ],
    timeline: [{ at: 0, src: 3 }],
    zoom: [{ at: 0, y: 45 }, { at: { cue: 2 }, y: 330 }],
  },
  {
    id: "capture",
    kicker: "Step 1 · Capture",
    heading: "Consent, then a quality gate",
    chip: "Quality gate · 0 units",
    note: "Stock photo (Pexels License) — no real user face",
    lines: [
      "First, a consent sheet: photos are processed in memory and never stored by us.",
      "A quality gate checks face width, light and angle before any unit is spent.",
      "For this demo, we upload a licensed stock photo.",
    ],
    ui: [
      { callout: "Consent first. Processed in memory, <b>never stored</b>." },
      { callout: "Gate checks: <b>front</b> · <b>bright</b> · <b>forehead visible</b> · face width <b>at least 60%</b>" },
      { callout: "The photo is sent to the analyzer with EXIF removed." },
    ],
    timeline: [
      { at: 0, src: [0, 6.8] },
      { at: { cue: 1, plus: 1.5 }, src: 9 },
      { at: { cue: 2 }, src: [13.0, 15.86] },
    ],
    zoom: [{ at: 0, y: 470 }, { at: { cue: 1, plus: 1.2 }, y: 30 }, { at: { cue: 2 }, y: 30 }],
  },
  {
    id: "analyze",
    kicker: "Step 2 · Analyze",
    heading: "Five features, one call",
    chip: "YouCam AI Face Analyzer · 10 units",
    lines: [
      "YouCam AI Face Analyzer reads five features in one call: eyelid, eye shape, lips, face shape and brows.",
      "That call costs ten units, and any value can be corrected by hand.",
      "The base shade is measured in the browser from the cheeks, at zero units.",
      "A hand-written rule table maps those attributes to Makeup Try-On parameters: shadow pattern, liner pattern and intensity.",
    ],
    ui: [
      { callout: "Eyelid · eye shape · lips · face shape · brows" },
      { callout: "<b>10 units</b> per analysis. Tap a card to correct it, <b>0 units</b>." },
      { callout: "Base shade: measured from the cheeks on the device." },
      { callout: "<b>Double lid</b> → crease shading + thin liner<br><span class=\"mono\">2colors3 · Upper11</span>" },
    ],
    timeline: [
      { at: 0, src: [0, 2.6] },
      { at: 1.6, src: 3 },
      { at: { cue: 2 }, src: 11.5 },
      { at: { cue: 3, plus: -0.2 }, src: [18, 19.8] },
      { at: { cue: 3, plus: 1.8 }, src: 20.4 },
    ],
    zoom: [{ at: 0, y: 40 }, { at: 1.6, y: 40 }, { at: { cue: 1 }, y: 400 }, { at: { cue: 2 }, y: 400 }, { at: { cue: 3 }, y: 400 }, { at: { cue: 3, plus: 1.8 }, y: 470 }],
  },
  {
    id: "lesson",
    kicker: "Step 3 · Learn",
    heading: "Every step rendered on your photo",
    chip: "YouCam Makeup Virtual Try-On · 1 unit per step",
    lines: [
      "YouCam Makeup Virtual Try-On renders each lesson step on the same photo, cumulatively.",
      "That's one unit per step, four per lesson, each render becomes the answer key, and the stepper marks steps done, active or pending.",
      "Drag to compare before and after.",
      "Each step explains why it fits this face, and lists the exact colors it uses.",
    ],
    ui: [
      { callout: "Same photo, steps stack up: base, brows, eyes, lips." },
      { callout: "<b>1 unit</b> per step · <b>4 units</b> per lesson<br>Stepper: done · active · pending" },
      { callout: "Slide between <b>My face</b> and the <b>answer</b>." },
      { callout: "Reason chip: why this technique fits <b>this</b> face." },
    ],
    timeline: [
      { at: 0, src: 3 },
      { at: { cue: 2 }, src: [12.2, 15.0] },
      { at: { cue: 3 }, src: [15.0, 20.9] },
    ],
    zoom: [{ at: 0, y: 150 }, { at: { cue: 1 }, y: 498 }, { at: { cue: 2 }, y: 120 }, { at: { cue: 3 }, y: 498 }, { at: { cue: 3, plus: 3.2 }, y: 380 }],
  },
  {
    id: "compare",
    kicker: "Two faces, one lesson",
    heading: "Same look, different technique",
    chip: "Pre-generated with the live API · 0 units now",
    note: "Both models are Pexels License stock photos",
    lines: [
      "The compare page shows the same lesson on two pre-generated stock faces.",
      "Their eyelids differ, a double lid and an inner double lid, so the rule table picks a different technique for each, and the try-on shows it.",
      "A what-if panel previews other branches, like a monolid, as rule-table text for zero units.",
    ],
    ui: [
      { callout: "Same look · two faces" },
      {
        heading: "Two eyelids, two techniques",
        callout:
          "<div class=\"vs\"><div><b>Model A · double lid</b>Crease shading + thin liner<span class=\"mono\">2colors3 · Upper11</span></div><div><b>Model B · inner double lid</b>Thin gradient above the liner<span class=\"mono\">2colors2 · Upper10</span></div></div>",
      },
      { heading: "Same look, different technique", callout: "What-if: <b>Monolid</b> → horizontal gradient + liner visible with eyes open" },
    ],
    timeline: [
      { at: 0, src: [0, 5.2] },
      { at: { cue: 1 }, src: 9.5 },
      { at: { cue: 1, plus: 1.4 }, src: [10.5, 14.0] },
      { at: { cue: 1, plus: 3.2 }, src: 15 },
      { at: { cue: 2 }, src: [15, 18.9] },
    ],
    zoom: [{ at: 0, y: 220 }, { at: { cue: 1 }, y: 220 }, { at: { cue: 1, plus: 1.4 }, y: 200 }, { at: { cue: 1, plus: 3.2 }, y: 275 }, { at: { cue: 2 }, y: 470 }],
  },
  {
    id: "grade",
    kicker: "Step 4 · Grade",
    heading: "Score your real attempt",
    chip: "0 YouCam units",
    note: "A stock image stands in for a real attempt",
    lines: [
      "Then you draw the look for real and snap your attempt. Here, a stock image stands in.",
      "Each region is compared with the answer by color difference: eye line, eyelid, cheek and lip.",
      "You get a score, a one-line correction, and a confidence level that drops when the photos don't match.",
    ],
    ui: [
      { callout: "Draw it, then snap your attempt." },
      { callout: "Per-region color difference: <b>eyeliner · eyelid · cheeks · lips</b>" },
      { callout: "Score + <b>one-line correction</b> + confidence" },
    ],
    timeline: [
      { at: 0, src: [0, 3.6] },
      { at: 2.6, src: [3.9, 19.6] },
    ],
    zoom: [{ at: 0, y: 150 }, { at: 2.6, y: 120 }, { at: { cue: 1 }, y: 120 }, { at: { cue: 2 }, y: 330 }],
  },
  {
    id: "shop",
    kicker: "Step 5 · Shop the step",
    heading: "Exact colors to products",
    chip: "CIEDE2000 matching · demo catalog",
    lines: [
      "Shop the step matches the exact hex colors of each step to products by CIEDE2000 color difference.",
      "The catalog is demo data; a partner feed would supply real products.",
    ],
    ui: [{ callout: "Hex colors from the step → closest products (ΔE)" }, { callout: "Demo catalog · real SKUs would come from a partner feed" }],
    timeline: [{ at: 0, src: [0.8, 12.8] }],
    zoom: [{ at: 0, y: 380 }, { at: { cue: 1 }, y: 170 }],
  },
  {
    id: "home",
    kicker: "Come back tomorrow",
    heading: "Practice streak and past results",
    chip: "Stored on this device only · 0 units",
    lines: [
      "Back on the home tab, your result is saved on this device as a practice streak and a past result.",
      "Returning users reuse the profile, so only the four render units apply.",
    ],
    ui: [{ callout: "Streak + past results live on <b>this device</b> only." }, { callout: "Reused profile → only <b>4 units</b> for a new lesson." }],
    timeline: [{ at: 0, src: 4 }],
    zoom: [{ at: 0, y: 100 }, { at: { cue: 1 }, y: 150 }],
  },
  {
    id: "share",
    kicker: "Share",
    heading: "Private by default",
    chip: "Photos never stored · units capped per session",
    lines: [
      "The share card is drawn on the device, with faces blurred by default.",
      "Privacy by design: photos are processed in memory and never stored, and each session is capped at twenty units, so spending stays bounded.",
      "Mirror Tutor: learn makeup on your own face.",
    ],
    ui: [
      { callout: "Card drawn on the device · faces <b>blurred</b> by default." },
      { callout: "<b>Never stored</b> · <b>20-unit</b> session cap · daily cap too" },
      { callout: "Mirror Tutor" },
    ],
    timeline: [{ at: 0, src: 2 }, { at: { cue: 1 }, src: 12 }],
    zoom: [{ at: 0, y: 60 }, { at: { cue: 1 }, y: 420 }],
  },
];

/* ── helpers ─────────────────────────────────────────────────────────────── */
function buildAudio(seg, dir) {
  const silence = (sec, f) => run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", sec.toFixed(3), "-c:a", "pcm_s16le", f]);
  const parts = [];
  seg.cues = [];
  let t = LEAD;
  const lead = path.join(dir, `${seg.id}-lead.wav`);
  silence(LEAD, lead);
  parts.push(lead);
  seg.lines.forEach((line, i) => {
    const aiff = path.join(dir, `${seg.id}-${i}.aiff`);
    const wav = path.join(dir, `${seg.id}-${i}.wav`);
    run("/usr/bin/say", ["-v", VOICE, "-r", String(RATE), "-o", aiff, line]);
    run(FFMPEG, ["-y", "-v", "error", "-i", aiff, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    const d = probe(wav);
    seg.cues.push({ start: t, end: t + d, text: line });
    parts.push(wav);
    t += d;
    if (i < seg.lines.length - 1) {
      const g = path.join(dir, `${seg.id}-gap${i}.wav`);
      silence(GAP, g);
      parts.push(g);
      t += GAP;
    }
  });
  const tail = path.join(dir, `${seg.id}-tail.wav`);
  silence(TAIL, tail);
  parts.push(tail);
  seg.duration = t + TAIL;
  const list = path.join(dir, `${seg.id}-list.txt`);
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  seg.audio = path.join(dir, `${seg.id}.wav`);
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", seg.audio]);
}

const resolveAt = (seg, at) => (typeof at === "number" ? at : at.cue === undefined ? seg.duration : seg.cues[at.cue].start + (at.plus ?? 0));

function loadSourceFrames(id) {
  const lines = readFileSync(path.join(SRC, "segments", `${id}-phone.txt`), "utf8").split("\n");
  const items = [];
  let t = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^file '(.*)'/);
    if (!m) continue;
    const d = lines[i + 1]?.match(/^duration (.*)/);
    items.push({ file: m[1], t0: t });
    if (d) t += Number(d[1]);
  }
  return { items, total: t };
}

function frameAt(items, t) {
  let cur = items[0];
  for (const it of items) {
    if (it.t0 <= t) cur = it;
    else break;
  }
  return cur.file;
}

function stageHtml(seg, si, ci) {
  const ui = { heading: seg.heading, chip: seg.chip, callout: "", ...(seg.ui?.[ci] ?? {}) };
  const total = SEGMENTS.length;
  const cue = seg.cues[ci].text;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;background:#fbf7f4;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1f1b1a;-webkit-font-smoothing:antialiased}
  .phone{position:absolute;left:${SCR_X}px;top:${SCR_Y}px;width:${SCR_W}px;height:${SCR_H}px;border-radius:34px;box-shadow:0 0 0 14px #1f1b1a,0 0 0 15px #3a3331,0 30px 60px 14px rgba(31,27,26,.28);background:#000}
  .zoom{position:absolute;left:${ZX}px;top:${ZY}px;width:${ZW}px;height:${ZH}px;border-radius:26px;box-shadow:0 0 0 6px #c8325b,0 18px 44px 6px rgba(31,27,26,.2);background:#000}
  .zlabel{position:absolute;left:${ZX}px;top:${ZY + ZH + 18}px;font-size:19px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#a8264a}
  .left{position:absolute;left:64px;top:60px;width:${SCR_X - 64 - 52}px;display:flex;flex-direction:column;gap:22px}
  .kick{font-size:23px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8264a}
  h1{margin:0;font-size:50px;line-height:1.1;font-weight:800;letter-spacing:-.01em}
  .chip{align-self:flex-start;background:#fcebe3;color:#a8264a;border-radius:22px;padding:12px 20px;font-size:22px;font-weight:700;line-height:1.25}
  .callout{background:#fff;border:2px solid #eadfd8;border-left:8px solid #c8325b;border-radius:16px;padding:20px 22px;font-size:28px;line-height:1.35;font-weight:600;box-shadow:0 6px 18px rgba(31,27,26,.07)}
  .callout b{color:#a8264a}.mono{font-family:ui-monospace,Menlo,monospace;font-size:21px;color:#6b605c;font-weight:600}
  .vs{display:flex;flex-direction:column;gap:16px;font-size:26px}.vs b{display:block;font-size:22px;margin-bottom:2px}.vs span{display:block;margin-top:2px}
  .vs>div{padding-bottom:12px;border-bottom:1px solid #eadfd8}.vs>div:last-child{border:0;padding:0}
  .note{font-size:20px;color:#6b605c;line-height:1.4}
  .sub{position:absolute;left:${ZX}px;width:${ZW}px;top:${ZY + ZH + 62}px;border-left:6px solid #c8325b;padding:4px 0 4px 24px;font-size:35px;line-height:1.33;font-weight:600;box-sizing:border-box}
  .bar{position:absolute;left:64px;bottom:92px;width:${SCR_X - 64 - 52}px;height:6px;border-radius:3px;background:#eadfd8}
  .bar i{display:block;height:6px;border-radius:3px;background:#c8325b;width:${(((si + 1) / total) * 100).toFixed(1)}%}
  .foot{position:absolute;left:64px;width:${SCR_X - 64 - 52}px;bottom:26px;font-size:17px;line-height:1.35;color:#6b605c}
  </style></head><body>
  <div class="phone"></div><div class="zoom"></div><div class="zlabel">Zoom on the app</div>
  <div class="left"><div class="kick">${esc(seg.kicker)}</div><h1>${esc(ui.heading)}</h1><div class="chip">${esc(ui.chip)}</div>${ui.callout ? `<div class="callout">${ui.callout}</div>` : ""}${seg.note ? `<div class="note">${esc(seg.note)}</div>` : ""}</div>
  <div class="sub">${esc(cue)}</div>
  <div class="bar"><i></i></div>
  <div class="foot">Mirror Tutor · recorded against the live YouCam API<br>Sample faces: Pexels License stock photos · demo catalog</div>
  </body></html>`;
}

function renderStage(seg, si, dir) {
  seg.stage = [];
  for (const [ci] of seg.cues.entries()) {
    const html = path.join(dir, `${seg.id}-${ci}.html`);
    const png = path.join(dir, `${seg.id}-${ci}.png`);
    writeFileSync(html, stageHtml(seg, si, ci));
    run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${W},${H}`, "--force-device-scale-factor=1", "--virtual-time-budget=1500", `--screenshot=${png}`, `file://${html}`]);
    seg.stage.push(png);
  }
}

function concatList(file, items, total) {
  const lines = [];
  items.forEach((it, i) => {
    const end = i + 1 < items.length ? items[i + 1].start : total;
    const d = end - it.start;
    if (d <= 0) return;
    lines.push(`file '${it.file}'`, `duration ${d.toFixed(4)}`);
  });
  lines.push(`file '${items.at(-1).file}'`);
  writeFileSync(file, lines.join("\n"));
}

function renderMask(file, w, h, r) {
  const html = file.replace(/\.png$/, ".html");
  writeFileSync(html, `<!doctype html><html><body style="margin:0;background:#000"><div style="width:${w}px;height:${h}px;border-radius:${r}px;background:#fff"></div></body></html>`);
  run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${w},${h}`, "--force-device-scale-factor=1", "--virtual-time-budget=1000", `--screenshot=${file}`, `file://${html}`]);
}
let masks;

function encodeSegment(seg, dir) {
  const { items } = loadSourceFrames(seg.id);
  const anchors = seg.timeline.map((a) => ({ t: resolveAt(seg, a.at), src: a.src })).sort((a, b) => a.t - b.t);
  const dur = seg.duration;
  const ticks = [];
  for (let i = 0; i < Math.round(dur * FPS); i++) {
    const t = i / FPS;
    let k = 0;
    while (k + 1 < anchors.length && anchors[k + 1].t <= t) k++;
    const a = anchors[k];
    const next = anchors[k + 1]?.t ?? dur;
    const s = Array.isArray(a.src) ? a.src[0] + ((a.src[1] - a.src[0]) * (t - a.t)) / Math.max(next - a.t, 0.001) : a.src;
    const file = frameAt(items, s);
    if (!ticks.length || ticks.at(-1).file !== file) ticks.push({ file, start: t });
  }
  const phoneList = path.join(dir, `${seg.id}-phone.txt`);
  concatList(phoneList, ticks, dur);
  const bgList = path.join(dir, `${seg.id}-stage.txt`);
  concatList(bgList, seg.stage.map((f, i) => ({ file: f, start: i === 0 ? 0 : seg.cues[i].start })), dur);

  // zoom window top-left (css px) -> frame px, eased between anchors
  const zs = seg.zoom.map((z) => ({ t: resolveAt(seg, z.at), x: z.x ?? 0, y: Math.min(z.y, CSS_H - ZOOM_CSS_H) })).sort((a, b) => a.t - b.t);
  const path1 = (key) => {
    let expr = String(zs[0][key] * FR);
    for (let i = 1; i < zs.length; i++) {
      const d = (zs[i][key] - zs[i - 1][key]) * FR;
      if (d !== 0) expr += `+(${d})*clip((t-${zs[i].t.toFixed(3)})/${ZOOM_MOVE},0,1)`;
    }
    return expr;
  };
  const filter = [
    `[1:v]setpts=PTS-STARTPTS,fps=${FPS},split[p1][p2]`,
    `[p1]scale=${SCR_W}:${SCR_H}:flags=lanczos,setsar=1,format=rgba[s0]`,
    `[3:v]format=gray,scale=${SCR_W}:${SCR_H}[m1]`,
    `[4:v]format=gray,scale=${ZW}:${ZH}[m2]`,
    `[s0][m1]alphamerge[scr]`,
    `[p2]crop=w=${CSS_W * FR}:h=${ZOOM_CSS_H * FR}:x='${path1("x")}':y='${path1("y")}',scale=${ZW}:${ZH}:flags=lanczos,unsharp=5:5:0.6,setsar=1,format=rgba[z0]`,
    `[z0][m2]alphamerge[zm]`,
    `[0:v]scale=${W}:${H},fps=${FPS}[bg]`,
    `[bg][scr]overlay=${SCR_X}:${SCR_Y}:eof_action=repeat[b1]`,
    `[b1][zm]overlay=${ZX}:${ZY}:eof_action=repeat,format=yuv420p[v]`,
    `[2:a]apad[a]`,
  ].join(";");
  const fs = path.join(dir, `${seg.id}-filter.txt`);
  writeFileSync(fs, filter);
  const out = path.join(dir, `${seg.id}.mp4`);
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", bgList, "-f", "concat", "-safe", "0", "-i", phoneList, "-i", seg.audio, "-loop", "1", "-framerate", String(FPS), "-t", (dur + 1).toFixed(2), "-i", masks.phone, "-loop", "1", "-framerate", String(FPS), "-t", (dur + 1).toFixed(2), "-i", masks.zoom, "-filter_complex_script", fs, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out]);
  return out;
}

/* ── main ────────────────────────────────────────────────────────────────── */
mkdirSync(WORK, { recursive: true });
const audioDir = path.join(WORK, "audio");
const stageDir = path.join(WORK, "stage");
const segDir = path.join(WORK, "segments");
for (const d of [audioDir, stageDir, segDir]) mkdirSync(d, { recursive: true });
masks = { phone: path.join(stageDir, "mask-phone.png"), zoom: path.join(stageDir, "mask-zoom.png") };
renderMask(masks.phone, SCR_W, SCR_H, 34);
renderMask(masks.zoom, ZW, ZH, 26);
const outs = [];
for (const [si, seg] of SEGMENTS.entries()) {
  buildAudio(seg, audioDir);
  if (ONLY && !ONLY.includes(seg.id)) continue;
  renderStage(seg, si, stageDir);
  outs.push(encodeSegment(seg, segDir));
  log(`${seg.id}: ${seg.duration.toFixed(2)}s, cues ${seg.cues.map((c) => c.start.toFixed(1)).join("/")}`);
}
const total = SEGMENTS.reduce((n, s) => n + s.duration, 0);
mkdirSync(path.dirname(OUT), { recursive: true });
const list = path.join(segDir, "all.txt");
writeFileSync(list, outs.map((o) => `file '${o}'`).join("\n"));
run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", OUT]);
log(`wrote ${OUT} (${probe(OUT).toFixed(2)}s; all segments ${total.toFixed(1)}s)`);
if (STILLS > 0) {
  const sdir = path.join(WORK, "stills");
  rmSync(sdir, { recursive: true, force: true });
  mkdirSync(sdir, { recursive: true });
  const t = probe(OUT);
  for (let i = 0; i < STILLS; i++) run(FFMPEG, ["-y", "-v", "error", "-ss", ((t * (i + 0.5)) / STILLS).toFixed(2), "-i", OUT, "-frames:v", "1", path.join(sdir, `still-${i + 1}.png`)]);
}
