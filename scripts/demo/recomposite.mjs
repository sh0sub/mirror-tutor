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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

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
// --tts openai: narrate with OpenAI gpt-4o-mini-tts (needs OPENAI_API_KEY; paid, about $0.015 per audio minute).
// Lines are cached by text+voice under <work>/tts-cache, so re-runs only pay for changed lines.
const TTS = args.tts ?? "say";
const TTS_VOICE = args["tts-voice"] ?? "marin";
const TTS_INSTRUCTIONS =
  "A young woman in her mid-twenties, a confident startup founder pitching her product at a hackathon demo day. Bright, youthful, self-assured and persuasive, like she knows this works. Rhythmic: vary pace and pitch, short punchy pauses, lift questions, land key words with conviction. Warm smile in the voice. Not robotic, not over-dramatic.";
const RATE = Number(args.rate ?? 150);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";
const FFPROBE = existsSync("/opt/homebrew/bin/ffprobe") ? "/opt/homebrew/bin/ffprobe" : "ffprobe";

const W = 1920, H = 1080, FPS = 30;
const CSS_W = 390, CSS_H = 844, FR = 1; // saved screencast frames are 390x844 (1 px per css px)
// Layout geometry: phone + zoom panel. Default for every scene; a segment may set `geo` (C10 cold open: 80 % phone height).
const GEO0 = { SCR_W: 462, SCR_H: 1000, SCR_X: 600, SCR_Y: 40, ZX: 1110, ZY: 40, ZW: 750, ZH: 666 };
let SCR_W, SCR_H, SCR_X, SCR_Y, ZX, ZY, ZW, ZH, ZOOM_CSS_H; // visible css height in the zoom panel
function setGeo(g = {}) {
  ({ SCR_W, SCR_H, SCR_X, SCR_Y, ZX, ZY, ZW, ZH } = { ...GEO0, ...g });
  ZOOM_CSS_H = Math.round((CSS_W * ZH) / ZW);
}
setGeo();
// LEAD/TAIL: silence before the first and after the last line of a segment (per-segment `lead`/`tail` override).
// Kept short so the whole video lands at 172-176 s (hard limit 180 s).
const LEAD = 0.35, GAP = 0.35, TAIL = 0.35, ZOOM_MOVE = 0.7;

// ffmpeg's xfade + looped-still graphs occasionally deadlock (0 % CPU, output stuck); a hung call is killed after 4 minutes and retried
const run = (cmd, argv) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20, timeout: 240000, killSignal: "SIGKILL" }).toString();
    } catch (e) {
      if (e.code !== "ETIMEDOUT" || attempt >= 4) throw e;
      console.error(`[recomp] ${cmd} hung, retry ${attempt}`);
    }
  }
};
const probe = (f) => Number(run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const log = (...a) => console.log("[recomp]", ...a);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ── C11 eye close-ups (split beat + compare gradient panel) ─────────────────────────────────────────────
 * Crops the eye band of a full-size 600x800 YouCam render (pre-generated, public/demo) around the MediaPipe eye landmarks,
 * scales it to w x h and draws the direction of the shadow gradient on both lids ("h" = horizontal, outer to inner corner;
 * "v" = vertical, lash line up to the crease). Landmarks: scripts/demo/model-*-landmarks.json (normalized to the 600x800 image).
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
const LM = (name) => JSON.parse(readFileSync(path.join(ROOT, "scripts/demo", `${name}-landmarks.json`), "utf8"));
async function eyeStrip({ img, lm, w, h, arrow, out, spanX = 1.14, radius = 24 }) {
  const P = (i) => ({ x: lm[i].x * 600, y: lm[i].y * 800 });
  const eyes = [
    { o: P(33), i: P(133), u: P(159), l: P(145) },
    { o: P(263), i: P(362), u: P(386), l: P(374) },
  ];
  const cx = (P(33).x + P(263).x) / 2, cy = (eyes[0].u.y + eyes[1].u.y + eyes[0].l.y + eyes[1].l.y) / 4;
  const cw = (P(263).x - P(33).x) * spanX, ch = (cw * h) / w;
  const x0 = Math.max(0, Math.min(600 - cw, cx - cw / 2)), y0 = Math.max(0, Math.min(800 - ch, cy - ch / 2 - ch * 0.04));
  const k = w / cw;
  const X = (x) => ((x - x0) * k).toFixed(1), Y = (y) => ((y - y0) * k).toFixed(1);
  const head = (x, y, dx, dy) => {
    const L = 15, a = Math.atan2(dy, dx), b = 0.5;
    return `M${x},${y}L${(x - L * Math.cos(a - b)).toFixed(1)},${(y - L * Math.sin(a - b)).toFixed(1)}M${x},${y}L${(x - L * Math.cos(a + b)).toFixed(1)},${(y - L * Math.sin(a + b)).toFixed(1)}`;
  };
  const arrows = arrow
    ? eyes
        .map((e) => {
          const ew = Math.abs(e.i.x - e.o.x), mx = (e.i.x + e.o.x) / 2;
          let d;
          if (arrow === "h") {
            // along the lid, a little above the lash line: outer corner -> inner corner
            const y = e.u.y - (e.l.y - e.u.y) * 0.55, xa = e.o.x + (e.o.x < e.i.x ? -4 : 4), xb = e.i.x;
            d = `M${X(xa)},${Y(y)}L${X(xb)},${Y(y)}${head(X(xb), Y(y), Math.sign(xb - xa), 0)}M${X(xa)},${Y(y)}L${X(xa)},${Y(y)}`;
          } else {
            // across the lid: from the lash line up toward the brow
            const yb = e.u.y - 3, yt = e.u.y - ew * 0.42;
            d = `M${X(mx)},${Y(yb)}L${X(mx)},${Y(yt)}${head(X(mx), Y(yt), 0, -1)}`;
          }
          return `<path d="${d}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="${d}" fill="none" stroke="#c8325b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
        })
        .join("")
    : "";
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" fill="#fff"/></svg>`;
  const base = await sharp(path.join(ROOT, "public/demo", img))
    .extract({ left: Math.round(x0), top: Math.round(y0), width: Math.round(cw), height: Math.round(ch) })
    .resize(w, h, { kernel: "lanczos3" })
    .sharpen({ sigma: 1.1 })
    .toBuffer();
  const layers = arrows ? [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${arrows}</svg>`) }] : [];
  await sharp(base).composite([...layers, { input: Buffer.from(mask), blend: "dest-in" }]).png().toFile(out);
}

/* ── shot list ───────────────────────────────────────────────────────────────
 * lines[i]      narration + subtitle i
 * speak[i]      optional spoken override for line i with hand-placed `say` pauses/emphasis (subtitle stays lines[i])
 * ui[i]         per-line left-column override { heading?, chip?, callout? } (callout = HTML)
 * timeline      [{ at, src }]: from `at` (seconds | { cue, plus } | { plus } = from the segment end) play source time `src` (number = hold, [a,b] = play a..b)
 * zoom          [{ at, y, x? }]: css-pixel top (and left) of the zoom window from `at` on, eased in over 0.7 s
 */
const SEGMENTS = [
  {
    // C10 cold open (0-~10 s): the sample model's own face with the real YouCam Makeup VTO look (lesson step 4, answer
    // render), the before/after slider swept from "My face" to the finished look. Source: work-c10 cold recording
    // (`record-video.mjs --mode mock --sample --only cold`, 0 units). Phone at 80 % of the frame height (864 of 1080 px,
    // frames shown at ~1:1), face close-up on the right, the thesis as the large caption (it is the subtitle).
    id: "hook",
    srcId: "cold",
    lead: 0.35,
    tail: 0.2,
    geo: { SCR_W: 399, SCR_H: 864, SCR_X: 700, SCR_Y: 108, ZX: 1170, ZY: 60, ZW: 690, ZH: 690 },
    badge: "Real YouCam Makeup VTO render",
    kicker: "Mirror Tutor",
    note: "Sample face (monolid): Unsplash License stock photo. Pre-generated with the YouCam API, 0 units spent here.",
    units: 0,
    // C16: one line, the tagline folded in (the closing line of the share scene still repeats it); the hook is ~6 s so the sample-trial tap lands at ~0:12
    lines: ["Tutorials are filmed on someone else's face. Learn makeup, on your own face."],
    cold: [`Tutorials are filmed on <span class="dim">someone else's face.</span> Learn makeup, <span class="acc">on your own face.</span>`],
    // C12 source (work-c12 frames-cold, live mode home screen, 0 units): the home hero slider (Bare / Full look): drag to the Bare end 1.0-1.8 s, sweep to the Full look 2.9-6.0 s, hold, back to the middle 9.7-11.5 s
    // C16: slider sweep 0.9-4.0 s, then hold the finished look to the end (the second line and the swipe back are gone)
    timeline: [{ at: 0, src: 2.6 }, { at: 0.9, src: [3.0, 6.1] }, { at: 4.0, src: 7.3 }],
    zoom: [{ at: 0, y: 70 }],
  },
  {
    // C11 split beat (~10-18 s): the same look on the monolid face and the double-lid face, full-size YouCam eye renders (lesson step 3, the
    // compare assets), the gradient direction marked on each lid. Full-screen still pair (arrows fade in on line 2), no phone.
    id: "split",
    split: {
      kicker: "Same look · two lids",
      left: { img: "model-c/step-3.jpg", lm: "model-c", arrow: "h", name: "Monolid face", tech: "Horizontal gradient + visible liner" },
      right: { img: "model-a/step-3.jpg", lm: "model-a", arrow: "v", name: "Double-lid face", tech: "Crease shading + thin liner" },
      note: "Real YouCam Makeup VTO renders, lesson step 3 (eyes), pre-generated · 0 units now · faces: Unsplash and Pexels License stock",
    },
    lead: 0.1,
    tail: 0.1,
    units: 0,
    // C16: one line (was two, 8.1 s -> ~5.5 s); the arrows fade in `arrowAt` seconds in
    lines: ["Same look, different lid. Monolid: horizontal gradient. Double lid: crease shading."],
    arrowAt: 1.9,
  },
  {
    // C16 (replaces the intro): the real 390 sample-trial tap on the home screen (live-mode local app, 0 units) and the first analysis screen.
    // Source: work-c16 trial take (`record-video.mjs --mode live --only trial`): steps hold 0.6-2.0 s, tap ripple 2.03-2.4 s, loading skeleton ~2.4-2.9 s (skipped),
    // result from 2.93 s. The same take continues into the analyze scene (raw reading, fix, rule table).
    id: "trial",
    badge: "Sample trial: pre-generated YouCam results (0 units)",
    step: 0,
    kicker: "Try it",
    heading: "Tap the sample model",
    chip: "No selfie needed · 0 units",
    units: 0,
    lead: 0.3,
    lines: ["Tap the sample model. Zero units, no selfie needed."],
    ui: [{ callout: "<b>Face Analyzer</b> reads features · 10 units<br><b>Makeup VTO</b> renders each step · 4 units<br><span class=\"plain\">Sample trial: pre-generated real YouCam results · <b>0 units</b></span>" }],
    timeline: [{ at: 0, src: 1.0 }, { at: 0.45, src: [1.95, 2.3] }, { at: 0.95, src: 4.0 }],
    zoom: [{ at: 0, y: 498 }, { at: 0.95, y: 400 }],
  },
  {
    // C16: the sample trial's first analysis (same take as the trial scene, so the page and strip match): raw Double-lid reading, "Fix the eyelid" tap, edit sheet,
    // "Corrected to Monolid", rule table. Two 2.5 s zoom panels (raw reading, Edited chip). The live call moved to the "live" scene.
    id: "analyze",
    srcId: "trial",
    badge: "Sample trial: pre-generated YouCam results (0 units)",
    pill: "Live call 10 units · here <b>0</b>",
    step: 2,
    kicker: "Step 2 · Analyze",
    heading: "Five features, one call",
    chip: "YouCam AI Face Analyzer · 10 units per live call",
    units: 0,
    lead: 0.15,
    lines: [
      "One Face Analyzer call reads five features. This time it read the monolid as double lid.",
      "That's ten units. And if it gets something wrong? Just tap to fix it.",
      "Then our rule table turns those features into try-on settings.",
    ],
    ui: [
      { callout: "Eyelid · eye shape · lips · face shape · brows<br><span class=\"plain\">Face Analyzer read this monolid face as <b>Double-lid</b> (sample trial, 0 units)</span>" },
      { callout: "Face Analyzer read this monolid face as <b>Double-lid</b>.<br>Tap <b>Fix the eyelid</b> → <b>Monolid</b> · <b>0 units</b>" },
      { callout: "<b>Monolid</b> → horizontal gradient + visible liner<br><span class=\"plain\">2-color shadow, style 1 · upper liner, style 6</span>" },
    ],
    // trial take: raw reading 3.5-6.0 s, fix tap 6.1-6.6, edit sheet 6.7-8.4, Monolid picked ~8.5, corrected state 9.7-12.1 s (holds to 16.5 s after a scroll),
    // rule-table tap 16.6-17.2 s, sheet open 17.2-20.3 s
    timeline: [
      { at: 0, src: 4.0 },
      { at: { cue: 1, plus: 0.9 }, src: [6.0, 11.9] },
      { at: { cue: 2, plus: -0.2 }, src: [16.4, 17.5] },
      { at: { cue: 2, plus: 0.9 }, src: 19 },
    ],
    pops: [
      { at: { cue: 0, plus: 2.4 }, dur: 2.5, src: 4.5, crop: { x: 12, y: 412, w: 348 }, ring: { x: 18, y: 598, w: 128, h: 40 }, label: "Raw read: Double lid (wrong for this face)" },
      { at: { cue: 1, plus: 3.2 }, dur: 2.5, src: 11, crop: { x: 14, y: 535, w: 310 }, ring: { x: 18, y: 604, w: 96, h: 40 }, label: "Fixed in the app: Monolid, Edited" },
    ],
    zoom: [{ at: 0, y: 400 }, { at: { cue: 1, plus: 0.9 }, y: 400 }, { at: { cue: 1, plus: 3.2 }, y: 440 }, { at: { cue: 2, plus: -0.3 }, y: 400 }],
  },
  {
    // C16 (was the capture scene + the first 7.5 s of analyze): "or bring your own selfie": consent sheet and quality gate (capture take, work-c15 frames, 0 units),
    // then the live Face Analyzer call (work-c13 livecall, 10 units, 883 -> 873): loading 1.6 s, result.
    id: "live",
    srcId: "capture",
    badge: "On-device quality gate (0 units)",
    step: 1,
    kicker: "Or your own selfie",
    heading: "Consent, quality gate, live call",
    chip: "Quality gate 0 units · live call 10 units",
    note: "Camera feed and uploaded photo are licensed stock photos (Pexels / Unsplash License), no real user face",
    units: 0,
    lead: 0.3,
    lines: ["Consent first. Then a quality gate.", "With your own selfie, the same call runs live: ten units."],
    ui: [
      { callout: "Consent first. Processed in memory, <b>never stored</b>.<br>Gate: <b>front</b> · <b>bright</b> · <b>forehead visible</b> · face width <b>at least 60%</b>" },
      {
        badge: "LIVE YouCam call, 10 units",
        pill: "Live call <b>10 units</b> · 883 \u2192 873",
        callout: "<b>LIVE YouCam call, 10 units</b><br>Units left <b>883 \u2192 873</b><br><span class=\"plain\">It read this monolid stock photo as <b>Double-lid</b>, same as the sample trial</span>",
      },
    ],
    // capture take (work-c15 frames-capture): consent sheet held on src 1.6, gate 44 % from 2.8 s, digital zoom 6.3-8.4 s, "Looks good" from 8.6 s
    timeline: [
      { at: 0, src: 1.6 },
      { at: 1.0, src: 4.2 },
      { at: 1.7, src: [6.3, 8.4] },
      { at: 2.5, src: 9.8 },
      { at: { cue: 1, plus: -0.05 }, src: [1.0, 2.6], from: "livecall" },
      { at: { cue: 1, plus: 1.55 }, src: [10.3, 13.6], from: "livecall" },
    ],
    zoom: [{ at: 0, y: 498 }, { at: 1.0, y: 267 }, { at: { cue: 1, plus: -0.05 }, y: 498 }],
  },
  {
    id: "lesson",
    step: 3,
    badge: "Sample trial: pre-generated YouCam renders (0 units)",
    pill: "Live lesson 4 units · here <b>0</b>",
    kicker: "Step 3 · Learn",
    heading: "Every step rendered on your photo",
    chip: "YouCam Makeup Virtual Try-On · 1 unit per step",
    units: 0,
    lines: [
      "Now the fun part. Makeup Virtual Try-On renders each step on your photo, one layer at a time.",
      "One unit per step. Each render becomes your answer key, and the stepper shows what's done, and what's next.",
      "Drag to compare. Before, and after.",
      "And every step tells you why it suits this face, with the exact colors it uses.",
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
    step: 4,
    badge: "YouCam VTO, pre-generated (0 units)",
    kicker: "Step 4 · Two faces",
    heading: "Same look, different technique",
    chip: "Pre-generated with the live API · 0 units now",
    note: "Faces: Pexels and Unsplash License stock",
    units: 14,
    lines: [
      "The analyzer missed the monolid, so we let the user correct it and the lesson changes.",
      "A monolid gets a horizontal gradient and a visible liner. A double lid gets crease shading.",
    ],
    ui: [
      {
        heading: "Analyzer misread, user corrected",
        chip: "Analyzer read Double-lid, corrected to Monolid",
        callout: "Analyzer read <b>Double-lid</b> → corrected to <b>Monolid</b><br><span class=\"plain\">Step 3 now uses the horizontal gradient, a real pre-generated YouCam render (0 units)</span>",
      },
      {
        heading: "Two eyelids, two techniques",
        note: "", // the licence line is also in the footer; the tall callout leaves no room above the step list
        chip: "Basis: rule of thumb, not validated",
        callout:
          "<div class=\"vs\"><div><b>Monolid face</b>Horizontal gradient + visible liner<span class=\"plain\">2-color shadow, style 1 · upper liner, style 6</span></div><div><b>Double-lid face</b>Crease shading + thin liner<span class=\"plain\">2-color shadow, style 3 · upper liner, style 11</span></div></div>",
      },
    ],
    // C12 source (work-c12 frames-compare, mock --sample, 0 units): the technique crops (horizontal vs vertical) now come first on /compare, then the rule table.
    // top of the page on the eye step 0-3.1 s (original/answer flip), hold, scroll to the crops 13.8-14.1 s (hold to 17.4 s), scroll to the rule table 17.4-17.7 s (hold to the end)
    // C14: the crops beat (src 13.7-17.4 s) moved to the "gradient" scene; this scene goes from the eye step straight to the rule table (src 17.4-17.7 scroll, hold to the end)
    timeline: [
      { at: 0, src: [0, 3.1] },
      { at: { cue: 0, plus: 3.2 }, src: 5 },
      { at: { cue: 1, plus: -0.1 }, src: [17.4, 17.7] },
      { at: { cue: 1, plus: 0.9 }, src: 21 },
    ],
    zoom: [{ at: 0, y: 252 }, { at: { cue: 0, plus: 0.9 }, y: 300 }, { at: { cue: 1, plus: -0.1 }, y: 380 }],
  },
  {
    // C14: the horizontal-vs-vertical beat moved here from the compare scene (right after the split beat). Source: the same compare recording
    // (work-c14 frames-compare, mock --sample, 0 units): scroll from the eye step to the two gradient crops 13.7-14.15 s, hold to 17.4 s.
    // No citation: no solid named public professional source for the monolid technique was found (docs/spec-matrix.md, P1-source), so it stays a rule of thumb.
    id: "gradient",
    srcId: "compare",
    badge: "YouCam VTO, pre-generated (0 units)",
    kicker: "Step 4 · Two gradients",
    step: 4, // C15: the gradient beat follows the correction beat and sits under the "Two faces" rail step,
    heading: "Horizontal vs vertical gradient",
    chip: "Same monolid face · 2 pre-generated renders · rule of thumb",
    // C15: no left-column credit note here (the footer carries it), so the callout stays clear of the rail
    units: 14,
    lead: 0.2,
    tail: 0.2,
    lines: ["Same look with a vertical gradient, the generic tutorial way, beside ours. Both are real YouCam renders."],
    ui: [
      {
        callout:
          "<div class=\"vs\"><div><b>Horizontal</b>Our monolid technique<span class=\"plain\">shadow style 1</span></div><div><b>Vertical</b>Generic tutorial way<span class=\"plain\">shadow style 3</span></div></div>",
      },
    ],
    timeline: [{ at: 0, src: [13.6, 14.15] }, { at: 0.9, src: 16 }],
    zoomOverlay: {
      at: 0.5,
      top: { img: "model-c/eye-horizontal.jpg", arrow: "h", label: "Horizontal gradient · our monolid technique" },
      bottom: { img: "model-c/eye-vertical.jpg", arrow: "v", label: "Vertical gradient · generic tutorial way" },
    },
    zoom: [{ at: 0, y: 125 }],
  },
  {
    id: "grade",
    step: 5,
    badge: "YouCam VTO, pre-generated (0 units)",
    // C10: wider-than-tall zoom panel is 560 px high so the thumbnails (and later the score ring + Eyeliner card) fit without clipping a text line
    geo: { ZH: 560 },
    kicker: "Step 5 · Grade",
    heading: "Score your real attempt",
    chip: "0 YouCam units",
    tag: "Simulated attempt",
    units: 14, // the SIMULATED ATTEMPT tag replaces the old note (a sample score, 79)
    lines: [
      "Now draw the look, snap it. A simulated attempt stands in.",
      "The YouCam render is our answer key. Each region is compared by color difference.",
      "Eyeliner: six point eight apart. Make it a bit stronger.",
      "You get a score, one clear fix, and an honest confidence level.",
    ],
    ui: [
      { callout: "Draw it, then snap your attempt.<br><span class=\"plain\">Sample attempt: simulated, deliberately off-shade</span>" },
      {
        callout:
          "<div class=\"key\">YouCam render = answer key</div><span class=\"lgd\"><i style=\"background:#ffd400\"></i>Eyeliner <i style=\"background:#b45cff\"></i>Eyelid <i style=\"background:#19d3ff\"></i>Cheeks <i style=\"background:#3ddc84\"></i>Lips</span>",
      },
      { callout: "<div class=\"key\">YouCam render = answer key</div>Eyeliner <b>ΔE2000 6.8</b><br><span class=\"mono\">#A57D64 vs #BB9074</span>" },
      { callout: "Score + <b>one-line correction</b> + confidence" },
    ],
    // C11: re-taken at the C11 app (work-c11 frames-grade, monolid sample, instant result); overlay-grade made from f000162 (top) and f000200 (scrolled) with model-c landmarks.
    // C10 (old) source (work-c10 frames-grade-share = the C9 grade take, --sample, simulated attempt, score 79): overlay-grade/grade-top.jpg is the top frame (1.97 s) with the
    // real region polygons drawn on the answer and the attempt thumbnails (scripts/demo/grade-overlay.ts); grade-row.jpg is the scrolled frame (5.73 s) with a box around the
    // Eyeliner delta-E line. The scroll between them is the original frames, 4.2-4.7 s.
    timeline: [
      { at: 0, file: "overlay-grade/grade-top.jpg" },
      { at: { cue: 2, plus: -0.35 }, src: [3.95, 5.05] },
      { at: { cue: 2, plus: 0.8 }, file: "overlay-grade/grade-row.jpg" },
    ],
    // C16: 2.5 s zoom panel on the Eyeliner delta-E line (boxed in grade-row.jpg)
    pops: [{ at: { cue: 2, plus: 1.5 }, dur: 2.5, file: "overlay-grade/grade-row.jpg", crop: { x: 40, y: 232, w: 300 }, label: "\u0394E2000 6.8 \u00b7 #A57D64 vs #BB9074" }],
    zoom: [{ at: 0, y: 40 }, { at: { cue: 2, plus: -0.35 }, y: 62 }],
  },
  {
    id: "shop",
    step: 6,
    badge: "YouCam VTO, pre-generated (0 units)",
    kicker: "Step 6 · Shop the step",
    heading: "Exact colors to products",
    chip: "CIEDE2000 matching · demo catalog",
    units: 14,
    lines: [
      "Love a color? Shop the step matches its exact shade to products, using CIEDE2000 color science.",
      "This catalog is demo data. A partner feed would plug in real products.",
    ],
    ui: [{ callout: "Hex colors from the step → closest products (ΔE)<br><span class=\"plain\">Finish check: <b>Matches finish</b> on the first lip row</span>" }, { callout: "Demo catalog · real SKUs would come from a partner feed" }],
    timeline: [{ at: 0, src: [0.8, 12.8] }],
    // C14 re-take (work-c14 frames-shop, mock --sample, 0 units): the app's sample chip sits under the app bar, the cart bar is gone until an item is added, the first lip row shows
    // the green "Matches finish" chip. List at css y ~567, "View in store" sheet at source 4.0-5.6 s (output = source - 0.8), scrolled rows + demo footnote from ~9.5 s.
    zoom: [{ at: 0, y: 470 }, { at: 3.2, y: 498 }, { at: 4.9, y: 470 }, { at: { cue: 1 }, y: 400 }],
  },
  {
    // C3: the /partner retailer view (concept screen, 0 units). C12: the widget is a live iframe on the real /embed/lesson route. C14: "Try your own shade" + the cost calculator.
    // Source: work-c14 frames-partner (live mode, home screen only, no API call, 0 units).
    id: "partner",
    step: 7,
    tail: 0.2, // C10: shorter dwell to pay for the longer cold open and grade scene
    badge: "YouCam VTO, pre-generated (0 units)",
    kicker: "For retailers",
    heading: "The lesson as an iframe widget",
    chip: "Concept screen · fictional store · 0 units",
    units: 14,
    lines: [
      "In your store: a widget beside the lip product, a four-step lesson in its exact shade, then add to cart. Try your own shade: no units spent.",
      "Integration is one plain iframe. No SDK, and no partner has used it yet.",
      "First lesson, fourteen units, then four. Enter your own visits, price and margin to see the break-even. Example inputs, no promised lift.",
    ],
    ui: [
      { callout: "<b>In your store</b>: product page widget \u2192 4-step lesson in this shade \u2192 add to cart<br><span class=\"mono\">Try your own shade \u00b7 demo catalog, not a partner feed \u00b7 0 units</span>" },
      { heading: "Integration is one iframe", callout: "<b>One plain iframe</b> \u00b7 no SDK<br><span class=\"mono\">A real route in this repo \u00b7 no partner has used it yet</span>" },
      {
        heading: "Unit meter, calculator, break-even",
        callout: "<div class=\"vs\"><div><b>Unit meter</b>First lesson <em>14</em> units, then <em>4</em></div><div><b>Calculator + break-even</b>Your visits, price, margin in<span class=\"mono\">Example inputs \u00b7 no lift claimed</span></div></div>",
      },
    ],
    // C16 source (work-c16 frames-partner, live mode home screen only, no API call, 0 units): tap "Retailer view" 1.6-2.3 s, page top 2.3-2.9 s (the widget iframe flashes Korean 2.6-3.2 s, skipped),
    // "In your store" strip + product card hold 3.3-4.4 s, scroll to the widget and slider drags 4.4-8.0 s, "Try your own shade" 8.1-10.6 s, Coral tapped ~10.8 s (the widget re-renders),
    // top with the Coral SKU 11.8-14.5 s, snippet scroll ~17.6-17.9 s (hold to 19.7), calculator typed ~19.8-20.2 s (52,000 units / month), break-even scroll 21.5-21.8 s, hold to 25.8 s
    timeline: [
      { at: 0, src: [0.9, 2.2] },
      { at: 1.3, src: 3.8 },
      { at: 4.6, src: [4.5, 8.0] },
      { at: { cue: 0, plus: 6.2 }, src: [8.2, 10.6] },
      { at: { cue: 0, plus: 8.2 }, src: 12.5 },
      { at: { cue: 1, plus: -0.2 }, src: [17.5, 18.0] },
      { at: { cue: 1, plus: 0.8 }, src: 18.8 },
      { at: { cue: 2, plus: -0.2 }, src: [19.4, 22.2] },
      { at: { cue: 2, plus: 3.4 }, src: 25 },
    ],
    zoom: [{ at: 0, y: 507 }, { at: 1.3, y: 140 }, { at: 4.6, y: 120 }, { at: { cue: 0, plus: 6.2 }, y: 230 }, { at: { cue: 0, plus: 8.2 }, y: 120 }, { at: { cue: 1, plus: -0.2 }, y: 60 }, { at: { cue: 2, plus: -0.2 }, y: 330 }, { at: { cue: 2, plus: 3.4 }, y: 450 }],
  },
  {
    id: "home",
    step: 8,
    badge: "Saved on this device (0 units)",
    kicker: "Come back tomorrow",
    heading: "Practice streak and past results",
    chip: "Stored on this device only · 0 units",
    note: "Past result seeded to the sample score (79) from the grade scene, for this demo",
    units: 14,
    lines: ["Come back tomorrow: your streak and past results wait on this device."],
    tail: 0.2,
    ui: [{ callout: "Streak + past results live on <b>this device</b> only.<br>Reused profile → <b>4 units</b> for a new lesson." }],
    // C5 source (work-c5 frames-home, mock --setup full, banner scrolled away): scrolled hold 1.4-8.3 s shows streak, past results and the home buttons incl. "Retailer view (concept)"
    timeline: [{ at: 0, src: 4 }],
    zoom: [{ at: 0, y: 130 }, { at: { cue: 0, plus: 2.6 }, y: 430 }],
  },
  {
    id: "share",
    step: 9,
    badge: "YouCam API, sample trial (0 units)",
    tail: 0.4, // C10: 1.0 -> 0.4 to pay for the longer cold open and grade scene
    kicker: "Share",
    heading: "Private by default",
    chip: "Photos never stored · units capped per session",
    units: 14,
    lines: [
      "Share your result with a card drawn on your device, faces blurred by default.",
      "Private by design. Nothing is stored, and every session is capped at twenty units.",
      "Mirror Tutor. Learn makeup, on your own face.",
    ],
    speak: [
      null,
      "[[rate 150]] Private by design. [[slnc 300]] Nothing is stored, [[slnc 160]] and every session is capped [[slnc 80]] at twenty units.",
      "[[rate 160; pbas +2]] Mirror Tutor. [[slnc 450]] [[rate 140; pbas -2]] Learn makeup, [[slnc 200]] on [[emph +]] your own [[emph -]] face.",
    ],
    ui: [
      { callout: "Card drawn on the device · faces <b>blurred</b> by default." },
      { callout: "<b>Never stored</b> · <b>20-unit</b> session cap · daily cap too" },
      {
        heading: "Try it yourself",
        chip: "Live YouCam API · sample trial 0 units",
        callout: "<b>No selfie needed</b> · 30 s walk-through<br><span class=\"url\">mirror-tutor.vercel.app</span>Tap <b>Try with a sample model</b> · 0 units",
      },
    ],
    // C5 source (work-c5 frames-share, mock --sample, banner scrolled away, score 79 = the grade scene): hold 0.13-5.6 s, scroll 5.6-5.9 s, then the "Next: retailer view" card below the progress section
    timeline: [{ at: 0, src: 1.5 }, { at: { cue: 1, plus: -0.3 }, src: [5.55, 5.95] }, { at: { cue: 1, plus: 0.9 }, src: 9 }],
    zoom: [{ at: 0, y: 150 }, { at: { cue: 1, plus: -0.3 }, y: 470 }],
  },
  {
    // C8: closing card (5-8 s, silent), plain claims only
    id: "close",
    // C9: the call to action is the biggest thing on the card (URL 120 px + the tap instruction), held for the whole 5 s card
    duration: 3.5, // C15: 6.0 -> 3.5 s
    card: {
      kicker: "Mirror Tutor",
      title: "Learn makeup, on your own face",
      cta: { url: "mirror-tutor.vercel.app", tap: "Tap \u201cTry with a sample model\u201d \u00b7 0 units" },
      repo: "github.com/sh0sub/mirror-tutor",
      chips: ["4 VTO calls per lesson", "Retailer SKUs at the end", "Open source, MIT", "No pilot claimed"],
      sub: "YouCam Face Analyzer + Makeup VTO  \u00b7  hackathon prototype",
    },
  },
];

/* ── helpers ─────────────────────────────────────────────────────────────── */
// macOS `say` embedded commands: wider pitch movement plus pauses at sentence and clause breaks,
// so the narration reads like a presenter instead of a flat list. Subtitles keep the plain line.
const prosody = (line) =>
  `[[pmod 60]] ${line}`
    .replace(/\? /g, "? [[slnc 320]] ")
    .replace(/\. /g, ". [[slnc 280]] ")
    .replace(/: /g, ": [[slnc 140]] ")
    .replace(/, /g, ", [[slnc 90]] ");

async function openaiSpeech(line, out) {
  const cacheDir = path.join(WORK, "tts-cache");
  mkdirSync(cacheDir, { recursive: true });
  const key = createHash("sha1").update(`${TTS_VOICE}\n${TTS_INSTRUCTIONS}\n${line}`).digest("hex");
  const cached = path.join(cacheDir, `${key}.mp3`);
  if (!existsSync(cached)) {
    if (!process.env.OPENAI_API_KEY) throw new Error("--tts openai needs OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: TTS_VOICE, input: line, instructions: TTS_INSTRUCTIONS, response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS failed: HTTP ${res.status}`);
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  run(FFMPEG, ["-y", "-v", "error", "-i", cached, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", out]);
}

async function buildAudio(seg, dir) {
  const silence = (sec, f) => run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", sec.toFixed(3), "-c:a", "pcm_s16le", f]);
  const parts = [];
  seg.cues = [];
  const leadS = seg.lead ?? LEAD;
  let t = leadS;
  const lead = path.join(dir, `${seg.id}-lead.wav`);
  silence(leadS, lead);
  parts.push(lead);
  for (const [i, line] of seg.lines.entries()) {
    const wav = path.join(dir, `${seg.id}-${i}.wav`);
    if (TTS === "openai") {
      await openaiSpeech(line, wav);
    } else {
      const aiff = path.join(dir, `${seg.id}-${i}.aiff`);
      const spoken = seg.speak?.[i] ? `[[pmod 60]] ${seg.speak[i]}` : prosody(line);
      run("/usr/bin/say", ["-v", VOICE, "-r", String(RATE), "-o", aiff, spoken]);
      run(FFMPEG, ["-y", "-v", "error", "-i", aiff, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    }
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
  }
  const tail = path.join(dir, `${seg.id}-tail.wav`);
  const tailS = seg.tail ?? TAIL;
  silence(tailS, tail);
  parts.push(tail);
  seg.duration = t + tailS;
  const list = path.join(dir, `${seg.id}-list.txt`);
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  seg.audio = path.join(dir, `${seg.id}.wav`);
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", seg.audio]);
}

const resolveAt = (seg, at) => (typeof at === "number" ? at : at.cue === undefined ? seg.duration + (at.plus ?? 0) : seg.cues[at.cue].start + (at.plus ?? 0));

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

// left-column step list (one entry per segment after the intro)
const HEAD_SEGS = 2; // the hook and the C11 split beat do not count as steps (C15: the gradient beat has an explicit `step`)
const FLOW = ["Capture", "Analyze", "Learn", "Two faces", "Grade", "Shop", "Retailer", "Streak", "Share"];

// C10 cold open: no step list or heading, just the thesis as a large caption (it is the subtitle) beside the phone and the face close-up
function coldStageHtml(seg, ci) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;background:#fbf7f4;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1f1b1a;-webkit-font-smoothing:antialiased}
  .phone{position:absolute;left:${SCR_X}px;top:${SCR_Y}px;width:${SCR_W}px;height:${SCR_H}px;border-radius:30px;box-shadow:0 0 0 13px #1f1b1a,0 0 0 14px #3a3331,0 30px 60px 14px rgba(31,27,26,.28);background:#000}
  .zoom{position:absolute;left:${ZX}px;top:${ZY}px;width:${ZW}px;height:${ZH}px;border-radius:26px;box-shadow:0 0 0 6px #c8325b,0 18px 44px 6px rgba(31,27,26,.2);background:#000}
  .badges{position:absolute;left:${ZX}px;top:${ZY + ZH + 22}px;width:${ZW}px;display:flex;align-items:center;gap:12px}
  .live{display:flex;align-items:center;gap:9px;background:#c8325b;color:#fff;border-radius:24px;padding:10px 20px;font-size:21px;font-weight:800;line-height:1.1}
  .live i{width:11px;height:11px;border-radius:6px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.35)}
  .note{position:absolute;left:${ZX}px;top:${ZY + ZH + 92}px;width:${ZW}px;font-size:21px;line-height:1.4;color:#6b605c}
  .left{position:absolute;left:72px;top:0;bottom:0;width:${SCR_X - 72 - 56}px;display:flex;flex-direction:column;justify-content:center;gap:30px}
  .kick{font-size:26px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a8264a}
  .cap{font-size:64px;line-height:1.12;font-weight:800;letter-spacing:-.015em}
  .cap .dim{color:#9a8f8b;text-decoration:line-through;text-decoration-thickness:4px;text-decoration-color:#c8325b}.cap .acc{color:#c8325b}
  .tags{display:flex;gap:12px;flex-wrap:wrap}.tag{background:#fcebe3;color:#a8264a;border-radius:22px;padding:10px 18px;font-size:22px;font-weight:700}
  </style></head><body>
  <div class="phone"></div><div class="zoom"></div>
  <div class="badges"><div class="live"><i></i>${esc(seg.badge)}</div></div><div class="note">${esc(seg.note)}</div>
  <div class="left"><div class="kick">${esc(seg.kicker)}</div><div class="cap">${seg.cold[ci]}</div><div class="tags">${(seg.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>
  </body></html>`;
}

function stageHtml(seg, si0, ci, uiOver = {}) {
  if (seg.cold) return coldStageHtml(seg, ci);
  const gi = SEGMENTS.findIndex((x) => x.step);
  const si = seg.step ?? Math.max(si0 - HEAD_SEGS - (gi >= 0 && gi < si0 ? 1 : 0), 0);
  const ui = { heading: seg.heading, chip: seg.chip, callout: "", ...(seg.ui?.[ci] ?? {}), ...uiOver };
  const total = SEGMENTS.length;
  const cue = seg.cues[ci].text;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;background:#fbf7f4;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1f1b1a;-webkit-font-smoothing:antialiased}
  .phone{position:absolute;left:${SCR_X}px;top:${SCR_Y}px;width:${SCR_W}px;height:${SCR_H}px;border-radius:34px;box-shadow:0 0 0 14px #1f1b1a,0 0 0 15px #3a3331,0 30px 60px 14px rgba(31,27,26,.28);background:#000}
  .zoom{position:absolute;left:${ZX}px;top:${ZY}px;width:${ZW}px;height:${ZH}px;border-radius:26px;box-shadow:0 0 0 6px #c8325b,0 18px 44px 6px rgba(31,27,26,.2);background:#000}
  .badges{position:absolute;left:${ZX}px;top:${ZY + ZH + 16}px;width:${ZW}px;display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}
  .live{display:flex;align-items:center;gap:9px;background:#c8325b;color:#fff;border-radius:24px;padding:9px 18px;font-size:19px;font-weight:800;line-height:1.1;white-space:nowrap}
  .live i{width:11px;height:11px;border-radius:6px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.35)}
  .units{position:absolute;right:16px;top:${-(ZH + 16) + 16}px;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;align-items:baseline;gap:8px;background:#fff;border:2px solid #c8325b;border-radius:24px;padding:6px 18px;font-size:17px;font-weight:700;color:#4a403d;white-space:nowrap}
  .units b{font-size:27px;font-weight:800;color:#a8264a;font-variant-numeric:tabular-nums}
  .left{position:absolute;left:64px;top:60px;width:${SCR_X - 64 - 52}px;display:flex;flex-direction:column;gap:22px}
  .kick{font-size:23px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8264a}
  h1{margin:0;font-size:50px;line-height:1.1;font-weight:800;letter-spacing:-.01em}
  .chip{align-self:flex-start;background:#fcebe3;color:#a8264a;border-radius:22px;padding:12px 20px;font-size:22px;font-weight:700;line-height:1.25}
  .callout{background:#fff;border:2px solid #eadfd8;border-left:8px solid #c8325b;border-radius:16px;padding:20px 22px;font-size:28px;line-height:1.35;font-weight:600;box-shadow:0 6px 18px rgba(31,27,26,.07)}
  .callout b{color:#a8264a}.mono{font-family:ui-monospace,Menlo,monospace;font-size:21px;color:#6b605c;font-weight:600}
  .vs{display:flex;flex-direction:column;gap:16px;font-size:26px}.vs b{display:block;font-size:22px;margin-bottom:2px}.vs span{display:block;margin-top:2px}
  .vs>div{padding-bottom:12px;border-bottom:1px solid #eadfd8}.vs>div:last-child{border:0;padding:0}
  .vs .basis{font-size:21px;font-weight:600;color:#4a403d}.vs .basis b{display:inline;font-size:21px;margin:0 8px 0 0}
  .vs em{font-style:normal;font-weight:800;color:#a8264a}
  .plain{font-size:20px;font-weight:600;color:#6b605c;line-height:1.3}
  .url{display:block;white-space:nowrap;font-size:34px;font-weight:800;color:#a8264a;letter-spacing:-.01em;margin:8px 0 10px}
  .note{font-size:20px;color:#6b605c;line-height:1.4;margin-top:24px}
  .bigtag{align-self:flex-start;background:#1f1b1a;color:#fff;border-radius:14px;padding:10px 22px;font-size:34px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
  .key{font-size:31px;line-height:1.15;font-weight:800;color:#a8264a;margin-bottom:10px}
  .lgd{font-size:21px;font-weight:700;white-space:nowrap}.lgd i{display:inline-block;width:18px;height:18px;border-radius:9px;margin:0 6px -2px 8px;border:2px solid #fff;box-shadow:0 0 0 1px #6b605c}.lgd i:first-child{margin-left:0}
  .sub{position:absolute;left:${ZX}px;width:${ZW}px;top:${ZY + ZH + 62}px;border-left:6px solid #c8325b;padding:4px 0 4px 24px;font-size:35px;line-height:1.33;font-weight:600;box-sizing:border-box}
  .bar{position:absolute;left:0;right:0;bottom:0;height:8px;background:#eadfd8}
  .bar i{display:block;height:8px;background:#c8325b;width:${(((si0 + 1) / total) * 100).toFixed(1)}%}
  .flow{position:absolute;left:64px;bottom:128px;width:${SCR_X - 64 - 52}px}
  .flow .fh{font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b605c;margin-bottom:12px}
  .flow ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
  .flow li{display:flex;align-items:center;gap:10px;height:42px;padding:0 14px;border-radius:12px;border:2px solid #eadfd8;background:#fff;font-size:20px;font-weight:600;color:#9a8f8b}
  .flow li i{font-style:normal;flex:none;width:24px;height:24px;border-radius:12px;display:grid;place-items:center;font-size:14px;font-weight:800;background:#f1e9e4;color:#6b605c}
  .flow li.done{color:#4a403d}.flow li.done i{background:#d9ece2;color:#2f7a55}
  .flow li.now{background:#c8325b;border-color:#c8325b;color:#fff;box-shadow:0 6px 16px rgba(200,50,91,.25)}.flow li.now i{background:#fff;color:#a8264a}
  .foot{position:absolute;left:64px;width:${SCR_X - 64 - 52}px;bottom:26px;font-size:17px;line-height:1.35;color:#6b605c}
  </style></head><body>
  <div class="phone"></div><div class="zoom"></div><div class="badges"><div class="live"><i></i>${esc(ui.badge ?? seg.badge ?? "YouCam results pre-generated with the live API (0 units now)")}</div><div class="units">${ui.pill ?? seg.pill ?? `Spent here: <b>0</b> units`}</div></div>
  <div class="left"><div class="kick">${esc(seg.kicker)}</div><h1>${esc(ui.heading)}</h1><div class="chip">${esc(ui.chip)}</div>${seg.tag ? `<div class="bigtag">${esc(seg.tag)}</div>` : ""}${ui.callout ? `<div class="callout">${ui.callout}</div>` : ""}${seg.note && ui.note !== "" ? `<div class="note">${esc(seg.note)}</div>` : ""}</div>
  <div class="sub">${esc(cue)}</div>
  <div class="flow"><div class="fh">${si === 0 ? "How it works" : `Step ${Math.min(si, FLOW.length)} of ${FLOW.length}`}</div><ol>${FLOW.map((f, i) => {
    const st = i + 1 < si ? "done" : i + 1 === si ? "now" : "";
    return `<li class="${st}"><i>${st === "done" ? "✓" : i + 1}</i>${esc(f)}</li>`;
  }).join("")}</ol></div>
  <div class="bar"><i></i></div>
  <div class="foot">${esc(seg.live ? "Mirror Tutor · live YouCam API (this scene)" : "Mirror Tutor · sample trial, pre-generated YouCam results (0 units)")}<br>Sample faces: Pexels and Unsplash License stock photos · demo catalog</div>
  </body></html>`;
}

// Headless Chrome occasionally leaves a raster tile unpainted (a white block in the phone's shadow).
// Render until two consecutive screenshots agree.
function screenshot(html, png, w, h) {
  const shot = (f) => {
    run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--run-all-compositor-stages-before-draw", `--window-size=${w},${h}`, "--force-device-scale-factor=1", "--virtual-time-budget=1500", `--screenshot=${f}`, `file://${html}`]);
    return readFileSync(f);
  };
  const alt = png.replace(/\.png$/, ".check.png");
  let prev = shot(png);
  for (let i = 0; i < 4; i++) {
    const cur = shot(alt);
    if (cur.equals(prev)) break;
    prev = cur;
    writeFileSync(png, cur);
  }
  rmSync(alt, { force: true });
}

function renderStage(seg, si, dir) {
  seg.stage = [];
  for (const [ci] of seg.cues.entries()) {
    const html = path.join(dir, `${seg.id}-${ci}.html`);
    const png = path.join(dir, `${seg.id}-${ci}.png`);
    writeFileSync(html, stageHtml(seg, si, ci));
    screenshot(html, png, W, H);
    seg.stage.push(png);
  }
  // C13: `stageSwitch` [{ at, ci, ui }]: an extra stage graphic (cue ci's text, ui overrides) from `at` on, for a mid-cue change of badge/callout
  seg.stageExtra = [];
  for (const [k, sw] of (seg.stageSwitch ?? []).entries()) {
    const html = path.join(dir, `${seg.id}-sw${k}.html`);
    const png = path.join(dir, `${seg.id}-sw${k}.png`);
    writeFileSync(html, stageHtml(seg, si, sw.ci, sw.ui));
    screenshot(html, png, W, H);
    seg.stageExtra.push({ file: png, start: resolveAt(seg, sw.at) });
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

/* ── phone timeline → shots ──────────────────────────────────────────────────
 * 1. Every output frame gets a source frame. A play range [a,b] keeps app motion (frames shorter than
 *    MOTION_MAX) at real speed and stretches/compresses only the holds, so scrolls never judder in slow motion.
 * 2. Cuts: every anchor jump, plus every abrupt app swap (hold → at most BURST_N frames → hold).
 *    Transient frames next to a cut (a skeleton or half-finished transition) are replaced by the neighbouring hold,
 *    and cuts closer than MIN_SHOT are merged, so no source frame flashes up for a few frames.
 * 3. Each shot is encoded with its own zoom window and shots are joined with an XF_N-frame cross-dissolve;
 *    zoom moves within ZOOM_SNAP of a cut happen at the cut (hidden by the dissolve) instead of jump-then-slide.
 */
const XF_N = 10, HOLD_N = 12, BURST_N = 9, MIN_SHOT_N = 18, MOTION_MAX = 0.2, ZOOM_SNAP = 0.8;

function rangePieces(items, total, a, b, L) {
  const pieces = [];
  items.forEach((it, j) => {
    const t1 = j + 1 < items.length ? items[j + 1].t0 : Math.max(total, b);
    const d = Math.min(t1, b) - Math.max(it.t0, a);
    if (d > 1e-6) pieces.push({ file: it.file, d, motion: d < MOTION_MAX });
  });
  if (!pieces.length) return [{ file: frameAt(items, a), out: L }];
  const M = pieces.filter((p) => p.motion).reduce((n, p) => n + p.d, 0);
  const Hs = pieces.filter((p) => !p.motion).reduce((n, p) => n + p.d, 0);
  const uni = L / (M + Hs);
  for (const p of pieces) p.out = L >= M && Hs > 0 ? (p.motion ? p.d : (p.d * (L - M)) / Hs) : L >= M ? p.d : p.d * uni;
  if (Hs === 0 && L > M) pieces.at(-1).out += L - M;
  return pieces;
}

const srcCache = {};
const sourceOf = (id) => (srcCache[id] ??= loadSourceFrames(id));

function planShots(seg, items, total) {
  // C6: a timeline entry may name another recording with `from` (the opening montage cuts between lesson, grade and shop)
  const anchors = seg.timeline.map((a) => ({ t: resolveAt(seg, a.at), src: a.src, from: a.from, file: a.file && path.join(SRC, a.file) })).sort((a, b) => a.t - b.t);
  const N = Math.round(seg.duration * FPS);
  anchors.forEach((a, k) => {
    a.i0 = Math.ceil(a.t * FPS - 1e-6);
    const next = anchors[k + 1]?.t ?? seg.duration;
    a.items = a.from ? sourceOf(a.from).items : items;
    a.total = a.from ? sourceOf(a.from).total : total;
    if (!a.file && Array.isArray(a.src)) a.pieces = rangePieces(a.items, a.total, a.src[0], a.src[1], next - a.t);
  });
  const fr = [];
  let k = 0;
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    while (k + 1 < anchors.length && anchors[k + 1].i0 <= i) k++;
    const a = anchors[k];
    if (a.file) fr.push(a.file);
    else if (!a.pieces) fr.push(frameAt(a.items, a.src));
    else {
      let tau = t - a.t, p = 0;
      while (p + 1 < a.pieces.length && tau >= a.pieces[p].out) tau -= a.pieces[p++].out;
      fr.push(a.pieces[p].file);
    }
  }
  const runsOf = () => {
    const runs = [];
    fr.forEach((f, i) => (runs.length && runs.at(-1).file === f ? runs.at(-1).n++ : runs.push({ file: f, s: i, n: 1 })));
    runs.forEach((r, j) => (r.hold = r.n >= HOLD_N || j === 0 || j === runs.length - 1));
    return runs;
  };
  const fill = (s, e, f) => { for (let i = s; i < e; i++) fr[i] = f; };
  let cuts = [];
  // (1) anchor jumps, dropping transients on either side
  let runs = runsOf();
  const runAt = (i) => runs.find((r) => i >= r.s && i < r.s + r.n);
  for (const a of anchors.slice(1)) {
    const c = a.i0;
    if (c <= 0 || c >= N || fr[c] === fr[c - 1]) continue;
    let j = runs.indexOf(runAt(c - 1));
    while (j >= 0 && !runs[j].hold) j--;
    if (j >= 0) { const e = runs[j].s + runs[j].n; if (c - e <= BURST_N) fill(e, c, runs[j].file); }
    j = runs.indexOf(runAt(c));
    while (j < runs.length && !runs[j].hold) j++;
    if (j < runs.length && runs[j].s - c <= BURST_N) fill(c, runs[j].s, runs[j].file);
    cuts.push(c);
  }
  // (2) abrupt app swaps between two holds
  runs = runsOf();
  const holds = runs.filter((r) => r.hold);
  for (let h = 1; h < holds.length; h++) {
    const A = holds[h - 1], B = holds[h], e = A.s + A.n, g = B.s - e;
    if (g > BURST_N || A.file === B.file || cuts.some((c) => c >= e && c <= B.s)) continue;
    const mid = e + Math.floor(g / 2);
    fill(e, mid, A.file);
    fill(mid, B.s, B.file);
    cuts.push(mid);
  }
  // (3) merge cuts that are too close together or to the segment edges
  cuts = [...new Set(cuts)].sort((x, y) => x - y);
  const kept = [];
  for (const c of cuts) {
    if (c < MIN_SHOT_N / 2) { fill(0, c, fr[c]); continue; }
    if (c > N - MIN_SHOT_N / 2) { fill(c, N, fr[c - 1]); continue; }
    if (kept.length && c - kept.at(-1) < MIN_SHOT_N) { fill(kept.at(-1), c, fr[c]); continue; }
    kept.push(c);
  }
  return { fr, cuts: kept.filter((c) => fr[c] !== fr[c - 1]), N };
}

function concatFrames(file, frames) {
  const lines = [];
  frames.forEach((f, i) => {
    if (i && f === frames[i - 1]) return;
    let n = 1;
    while (i + n < frames.length && frames[i + n] === f) n++;
    lines.push(`file '${f}'`, `duration ${(n / FPS).toFixed(5)}`);
  });
  lines.push(`file '${frames.at(-1)}'`);
  writeFileSync(file, lines.join("\n"));
}

function encodeSegment(seg, dir) {
  const { items, total } = sourceOf(seg.srcId ?? seg.id);
  const { fr, cuts, N } = planShots(seg, items, total);
  const dur = seg.duration;
  const hN = XF_N / 2;
  const bounds = [0, ...cuts, N];
  const bgList = path.join(dir, `${seg.id}-stage.txt`);
  concatList(bgList, [...seg.stage.map((f, i) => ({ file: f, start: i === 0 ? 0 : seg.cues[i].start })), ...(seg.stageExtra ?? [])].sort((a, b) => a.start - b.start), dur);

  // zoom anchors: snap moves near a cut onto the cut
  const cutT = cuts.map((c) => c / FPS);
  const zs = seg.zoom
    .map((z) => ({ t: resolveAt(seg, z.at), x: z.x ?? 0, y: Math.min(z.y, CSS_H - ZOOM_CSS_H) }))
    .sort((a, b) => a.t - b.t)
    .map((z, i) => {
      if (i === 0) return z;
      const near = cutT.find((c) => Math.abs(c - z.t) <= ZOOM_SNAP);
      return near === undefined ? z : { ...z, t: near };
    });
  const zoomExpr = (key, S, E, W) => {
    let v = zs[0][key];
    const terms = [];
    for (let i = 1; i < zs.length; i++) {
      const d = zs[i][key] - zs[i - 1][key];
      if (zs[i].t <= S + 1e-6) v += d;
      else if (zs[i].t < E - 1e-6 && d !== 0) terms.push(`+(${d * FR})*clip((t+${W.toFixed(4)}-${zs[i].t.toFixed(4)})/${ZOOM_MOVE},0,1)`);
    }
    return `${v * FR}${terms.join("")}`;
  };

  const inputs = [];
  const filter = [];
  const shots = bounds.length - 1;
  // C11: optional opaque panel laid over the zoom window from seg.zoomOverlay.at on; C16: plus timed 2.5 s zoom panels (seg.pops)
  const panels = [
    ...(seg.zoomPanelFile ? [{ file: seg.zoomPanelFile, at: resolveAt(seg, seg.zoomOverlay.at), until: seg.zoomOverlay.until ? resolveAt(seg, seg.zoomOverlay.until) : null, fin: 0.5, fout: 0.4 }] : []),
    ...(seg.popFiles ?? []).map((p) => ({ file: p.file, at: p.at, until: p.at + p.dur, fin: 0.25, fout: 0.25 })),
  ];
  for (let k = 0; k < shots; k++) {
    const s0 = bounds[k], s1 = bounds[k + 1];
    const w0 = k === 0 ? 0 : s0 - hN, w1 = k === shots - 1 ? N : s1 + hN;
    const frames = [];
    for (let i = w0; i < w1; i++) frames.push(fr[Math.min(Math.max(i, s0), s1 - 1)]);
    const list = path.join(dir, `${seg.id}-phone${k}.txt`);
    concatFrames(list, frames);
    inputs.push("-f", "concat", "-safe", "0", "-i", list);
    const n = 4 + k;
    const S = s0 / FPS, E = s1 / FPS, W = w0 / FPS;
    filter.push(
      `[${n}:v]setpts=PTS-STARTPTS,fps=${FPS},settb=1/${FPS},format=yuv444p,split[pa${k}][pz${k}]`,
      `[pa${k}]scale=${SCR_W}:${SCR_H}:flags=lanczos,setsar=1[sa${k}]`,
      `[pz${k}]crop=w=${CSS_W * FR}:h=${ZOOM_CSS_H * FR}:x='${zoomExpr("x", S, E, W)}':y='${zoomExpr("y", S, E, W)}',scale=${ZW}:${ZH}:flags=lanczos,unsharp=5:5:0.6,setsar=1[za${k}]`,
    );
  }
  let sa = "sa0", za = "za0";
  for (let k = 1; k < shots; k++) {
    const off = ((bounds[k] - hN) / FPS).toFixed(4);
    filter.push(`[${sa}][sa${k}]xfade=transition=fade:duration=${XF_N / FPS}:offset=${off}[sx${k}]`, `[${za}][za${k}]xfade=transition=fade:duration=${XF_N / FPS}:offset=${off}[zx${k}]`);
    sa = `sx${k}`;
    za = `zx${k}`;
  }
  filter.push(
    `[${sa}]format=rgba[s0]`,
    `[${za}]format=rgba[z0]`,
    `[2:v]format=gray,scale=${SCR_W}:${SCR_H}[m1]`,
    `[3:v]format=gray,scale=${ZW}:${ZH}[m2]`,
    `[s0][m1]alphamerge[scr]`,
    `[z0][m2]alphamerge[zm]`,
    `[0:v]scale=${W}:${H},fps=${FPS}[bg]`,
    `[bg][scr]overlay=${SCR_X}:${SCR_Y}:eof_action=repeat[b1]`,
    `[b1][zm]overlay=${ZX}:${ZY}:eof_action=repeat[b2]`,
    ...panels.flatMap((pn, i) => [
      `[${4 + shots + i}:v]format=rgba,fade=t=in:st=${pn.at.toFixed(3)}:d=${pn.fin}:alpha=1${pn.until ? `,fade=t=out:st=${(pn.until - pn.fout).toFixed(3)}:d=${pn.fout}:alpha=1` : ""}[zp${i}]`,
      `[b${i + 2}][zp${i}]overlay=${ZX}:${ZY}:eof_action=repeat${i === panels.length - 1 ? ",format=yuv420p[v]" : `[b${i + 3}]`}`,
    ]),
    ...(panels.length ? [] : [`[b2]format=yuv420p[v]`]),
    `[1:a]apad[a]`,
  );
  const fs = path.join(dir, `${seg.id}-filter.txt`);
  writeFileSync(fs, filter.join(";\n"));
  const out = path.join(dir, `${seg.id}.mp4`);
  const loop = (f) => ["-loop", "1", "-framerate", String(FPS), "-t", (dur + 1).toFixed(2), "-i", f];
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", bgList, "-i", seg.audio, ...loop(masks.phone), ...loop(masks.zoom), ...inputs, ...panels.flatMap((pn) => loop(pn.file)), "-filter_complex_script", fs, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out]);
  seg.cutTimes = cutT;
  return out;
}

// C11 compare gradient panel: the two eye close-ups of the same monolid face (horizontal vs vertical shadow gradient) at the full zoom-panel size
// with the gradient direction drawn on each lid, laid over the zoom window while the phone shows the small crops.
async function makeZoomPanel(seg, dir) {
  const z = seg.zoomOverlay;
  const SH = Math.round((ZH - 22) / 2);
  const files = [];
  for (const [i, c] of [z.top, z.bottom].entries()) {
    const f = path.join(dir, `${seg.id}-zoompanel-${i}.png`);
    await eyeStrip({ img: c.img, lm: LM(c.lm ?? "model-c"), w: ZW, h: SH, arrow: c.arrow, out: f, spanX: 1.2, radius: 20 });
    files.push(f);
  }
  const pill = (y, text) => `<g><rect x="16" y="${y}" width="${Math.round(text.length * 12.6 + 34)}" height="40" rx="20" fill="#1f1b1a" fill-opacity=".86"/><text x="33" y="${y + 27}" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="21" fill="#fff">${esc(text)}</text></g>`;
  const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${ZW}" height="${ZH}">${pill(SH - 56, z.top.label)}${pill(SH + 22 + SH - 56, z.bottom.label)}</svg>`;
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${ZW}" height="${ZH}"><rect width="${ZW}" height="${ZH}" rx="26" fill="#fff"/></svg>`;
  const out = path.join(dir, `${seg.id}-zoompanel.png`);
  await sharp({ create: { width: ZW, height: ZH, channels: 4, background: "#fbf7f4" } })
    .composite([{ input: files[0], top: 0, left: 0 }, { input: files[1], top: SH + 22, left: 0 }, { input: Buffer.from(labels) }, { input: Buffer.from(mask), blend: "dest-in" }])
    .png()
    .toFile(out);
  return out;
}

// C16 zoom panels: a 2.5 s magnified crop of one source frame (css px crop {x, y, w}; the height follows the panel's aspect) over the zoom window,
// an optional ring ({x, y, w, h} in the same css px) and a label pill. `src` = a time in the segment's source take, `file` = a prepared frame in the source dir.
async function makePops(seg, dir) {
  const { items } = sourceOf(seg.srcId ?? seg.id);
  seg.popFiles = [];
  for (const [i, pop] of seg.pops.entries()) {
    const frame = pop.file ? path.join(SRC, pop.file) : frameAt(items, pop.src);
    const cw = pop.crop.w, ch = Math.round((cw * ZH) / ZW);
    const k = ZW / cw;
    const x0 = Math.max(0, Math.min(CSS_W - cw, pop.crop.x)), y0 = Math.max(0, Math.min(CSS_H - ch, pop.crop.y));
    const base = await sharp(frame).extract({ left: Math.round(x0), top: Math.round(y0), width: cw, height: ch }).resize(ZW, ZH, { kernel: "lanczos3" }).sharpen({ sigma: 1.0 }).toBuffer();
    const ring = pop.ring
      ? `<rect x="${((pop.ring.x - x0) * k).toFixed(1)}" y="${((pop.ring.y - y0) * k).toFixed(1)}" width="${(pop.ring.w * k).toFixed(1)}" height="${(pop.ring.h * k).toFixed(1)}" rx="14" fill="none" stroke="#fff" stroke-width="10"/><rect x="${((pop.ring.x - x0) * k).toFixed(1)}" y="${((pop.ring.y - y0) * k).toFixed(1)}" width="${(pop.ring.w * k).toFixed(1)}" height="${(pop.ring.h * k).toFixed(1)}" rx="14" fill="none" stroke="#c8325b" stroke-width="5"/>`
      : "";
    const pw = Math.round(pop.label.length * 13.2 + 40);
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${ZW}" height="${ZH}">${ring}<g><rect x="18" y="18" width="${pw}" height="44" rx="22" fill="#1f1b1a" fill-opacity=".88"/><text x="38" y="49" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="23" fill="#fff">${esc(pop.label)}</text></g></svg>`;
    const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${ZW}" height="${ZH}"><rect width="${ZW}" height="${ZH}" rx="26" fill="#fff"/></svg>`;
    const out = path.join(dir, `${seg.id}-pop${i}.png`);
    await sharp(base).composite([{ input: Buffer.from(overlay) }, { input: Buffer.from(mask), blend: "dest-in" }]).png().toFile(out);
    seg.popFiles.push({ file: out, at: resolveAt(seg, pop.at), dur: pop.dur });
  }
}

// C11 split beat: two stills (eye renders; the arrows and the second line appear with line 2), cross-faded, with the narration audio
async function makeSplit(seg, dir) {
  const sp = seg.split;
  const PW = 860, PH = 540;
  const strips = {};
  for (const side of ["left", "right"]) {
    for (const withArrow of [false, true]) {
      const f = path.join(dir, `${seg.id}-${side}-${withArrow ? "a" : "n"}.png`);
      const c = sp[side];
      await eyeStrip({ img: c.img, lm: LM(c.lm), w: PW, h: PH, arrow: withArrow ? c.arrow : null, out: f });
      strips[`${side}${withArrow ? "A" : "N"}`] = f;
    }
  }
  const page = (withArrow) => `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${W}px;height:${H}px;background:#fbf7f4;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1f1b1a;-webkit-font-smoothing:antialiased}
    .k{position:absolute;left:80px;top:48px;font-size:30px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a8264a}
    .badge{position:absolute;right:80px;top:40px;background:#c8325b;color:#fff;border-radius:26px;padding:10px 22px;font-size:23px;font-weight:800}
    .p{position:absolute;top:118px;width:${PW}px}
    .p img{display:block;width:${PW}px;height:${PH}px;border-radius:24px;box-shadow:0 0 0 5px #c8325b,0 16px 40px rgba(31,27,26,.18)}
    .lab{margin-top:26px;display:flex;flex-direction:column;gap:6px}
    .lab b{font-size:40px;font-weight:800}.lab span{font-size:30px;font-weight:700;color:#a8264a;opacity:${withArrow ? 1 : 0.35}}
    .cap{position:absolute;left:80px;right:80px;top:836px;text-align:center;font-size:76px;line-height:1.1;font-weight:800;letter-spacing:-.015em}
    .cap em{font-style:normal;color:#c8325b}
    .sub{position:absolute;left:80px;right:80px;top:938px;text-align:center;font-size:38px;font-weight:600;color:#4a403d;min-height:50px}
    .note{position:absolute;left:80px;right:80px;bottom:22px;text-align:center;font-size:19px;color:#6b605c}
  </style></head><body>
  <div class="k">${esc(sp.kicker)}</div><div class="badge">YouCam VTO, pre-generated (0 units)</div>
  ${["left", "right"]
    .map((side, i) => `<div class="p" style="left:${80 + i * (PW + 40)}px"><img src="file://${strips[side + (withArrow ? "A" : "N")]}"><div class="lab"><b>${esc(sp[side].name)}</b><span>${esc(sp[side].tech)}</span></div></div>`)
    .join("")}
  <div class="cap">Same look. <em>Different lid.</em> Different technique.</div>
  <div class="sub">${seg.lines.length > 1 ? (withArrow ? esc(seg.lines[1]) : "") : esc(seg.lines[0])}</div>
  <div class="note">${esc(sp.note)}</div></body></html>`;
  const stills = [];
  for (const withArrow of [false, true]) {
    const html = path.join(dir, `${seg.id}-${withArrow ? "b" : "a"}.html`);
    const png = path.join(dir, `${seg.id}-${withArrow ? "b" : "a"}.png`);
    writeFileSync(html, page(withArrow));
    screenshot(html, png, W, H);
    stills.push(png);
  }
  const XF = 0.4, t1 = seg.arrowAt ?? seg.cues[1].start - 0.1; // second still from just before line 2 (C16: or `arrowAt` seconds in)
  const out = path.join(dir, `${seg.id}.mp4`);
  const loop = (f, t) => ["-loop", "1", "-framerate", String(FPS), "-t", t.toFixed(3), "-i", f];
  run(FFMPEG, [
    "-y", "-v", "error", ...loop(stills[0], t1 + XF), ...loop(stills[1], seg.duration - t1 + 1), "-i", seg.audio,
    "-filter_complex", `[0:v]format=yuv420p,setsar=1[a];[1:v]format=yuv420p,setsar=1[b];[a][b]xfade=transition=fade:duration=${XF}:offset=${t1.toFixed(3)},fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuvj420p[v];[2:a]apad[aa]`,
    "-map", "[v]", "-map", "[aa]", "-t", seg.duration.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuvj420p", "-color_range", "pc", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out,
  ]);
  seg.cutTimes = [t1];
  return out;
}

// C6 title card: one still (1920x1080) held for seg.duration with a silent audio track, encoded like the other segments
function makeCard(seg, dir) {
  const c = seg.card;
  const html = path.join(dir, `${seg.id}.html`);
  const png = path.join(dir, `${seg.id}.png`);
  writeFileSync(
    html,
    `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${W}px;height:${H}px;background:#fbf7f4;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1f1b1a;-webkit-font-smoothing:antialiased}
    .c{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:34px;text-align:center}
    .k{font-size:34px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a8264a}
    h1{margin:0;font-size:96px;line-height:1.08;font-weight:800;letter-spacing:-.02em;max-width:1800px;white-space:nowrap}
    .chips{display:flex;gap:24px;flex-wrap:wrap;justify-content:center}.chips.stack{flex-direction:column;align-items:center;gap:22px}.chip{background:#fcebe3;color:#a8264a;border-radius:44px;padding:20px 40px;font-size:44px;font-weight:800;border:3px solid #c8325b}.stack .chip{font-size:64px;padding:18px 54px}
    .s{font-size:32px;font-weight:600;color:#6b605c}
    .cta{display:flex;flex-direction:column;align-items:center;gap:14px;background:#c8325b;color:#fff;border-radius:36px;padding:34px 80px 38px;box-shadow:0 14px 40px rgba(200,50,91,.3)}.cta .u{font-size:124px;font-weight:800;letter-spacing:-.02em;line-height:1.05}.cta .t{font-size:58px;font-weight:700}
    .c.has-cta{gap:30px}.has-cta h1{font-size:72px}.has-cta .chip{font-size:44px;padding:16px 38px}.repo{font-size:54px;font-weight:800;color:#1f1b1a;letter-spacing:-.01em}.repo span{color:#a8264a}
    </style></head><body><div class="c${c.cta ? " has-cta" : ""}"><div class="k">${esc(c.kicker)}</div><h1>${esc(c.title)}</h1>${c.cta ? `<div class="cta"><div class="u">${esc(c.cta.url)}</div><div class="t">${esc(c.cta.tap)}</div></div>` : ""}${c.repo ? `<div class="repo"><span>Code:</span> ${esc(c.repo)}</div>` : ""}<div class="chips${c.stack ? " stack" : ""}">${c.chips.map((x) => `<div class="chip">${esc(x)}</div>`).join("")}</div><div class="s">${esc(c.sub)}</div></div></body></html>`,
  );
  screenshot(html, png, W, H);
  const out = path.join(dir, `${seg.id}.mp4`);
  run(FFMPEG, ["-y", "-v", "error", "-loop", "1", "-framerate", String(FPS), "-i", png, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", seg.duration.toFixed(3), "-vf", `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuvj420p`, "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuvj420p", "-color_range", "pc", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out]); // yuvj420p/pc like the other segments (concat -c copy keeps the first segment's range)
  seg.cutTimes = [];
  return out;
}

/* ── main ────────────────────────────────────────────────────────────────── */
mkdirSync(WORK, { recursive: true });
const audioDir = path.join(WORK, "audio");
const stageDir = path.join(WORK, "stage");
const segDir = path.join(WORK, "segments");
for (const d of [audioDir, stageDir, segDir]) mkdirSync(d, { recursive: true });
const maskCache = {};
function applyGeo(g) {
  setGeo(g);
  const key = `${SCR_W}x${SCR_H}-${ZW}x${ZH}`;
  if (!maskCache[key]) {
    const m = { phone: path.join(stageDir, `mask-phone-${key}.png`), zoom: path.join(stageDir, `mask-zoom-${key}.png`) };
    renderMask(m.phone, SCR_W, SCR_H, 34);
    renderMask(m.zoom, ZW, ZH, 26);
    maskCache[key] = m;
  }
  masks = maskCache[key];
}
const outs = [];
for (const [si, seg] of SEGMENTS.entries()) {
  if (seg.card) {
    outs.push(makeCard(seg, segDir));
    log(`${seg.id}: title card, ${seg.duration.toFixed(2)}s`);
    continue;
  }
  await buildAudio(seg, audioDir);
  if (ONLY && !ONLY.includes(seg.id)) continue;
  if (seg.split) {
    outs.push(await makeSplit(seg, segDir));
    log(`${seg.id}: split beat, ${seg.duration.toFixed(2)}s, cues ${seg.cues.map((c) => c.start.toFixed(1)).join("/")}`);
    continue;
  }
  applyGeo(seg.geo);
  if (seg.zoomOverlay) seg.zoomPanelFile = await makeZoomPanel(seg, stageDir);
  if (seg.pops) await makePops(seg, stageDir);
  renderStage(seg, si, stageDir);
  outs.push(encodeSegment(seg, segDir));
  log(`${seg.id}: ${seg.duration.toFixed(2)}s, cues ${seg.cues.map((c) => c.start.toFixed(1)).join("/")}, dissolves ${seg.cutTimes.map((c) => c.toFixed(2)).join("/") || "none"}`);
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
