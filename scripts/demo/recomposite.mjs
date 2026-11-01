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
 * speak[i]      optional spoken override for line i with hand-placed `say` pauses/emphasis (subtitle stays lines[i])
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
      "Every makeup tutorial is filmed on someone else's eyes. If you have monolids? It just doesn't fit.",
      "So we built Mirror Tutor. Makeup lessons, on your own face.",
      "YouCam's Face Analyzer reads your features. A rule table picks the technique. And Makeup Virtual Try-On paints every step right on your photo.",
    ],
    speak: [
      "Every makeup tutorial [[slnc 120]] is filmed on [[emph +]] someone else's [[emph -]] eyes. [[slnc 380]] If you have monolids? [[slnc 320]] [[rate 135]] It just doesn't fit.",
      "[[rate 168; pbas +2]] So we built Mirror Tutor. [[slnc 260]] [[rate 148; pbas -2]] Makeup lessons, [[slnc 160]] on [[emph +]] your own [[emph -]] face.",
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
      "First, consent. Your photo is processed in memory, and never stored.",
      "Then a quality gate checks light, angle and framing, before a single unit is spent.",
      "For this demo, we'll use a licensed stock photo.",
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
      "One call to YouCam's Face Analyzer reads five features: eyelid, eye shape, lips, face shape and brows.",
      "That's ten units. And if it gets something wrong? Just tap to fix it.",
      "Skin tone is measured right in the browser, from the cheeks, for free.",
      "Then our rule table turns those features into try-on settings: shadow pattern, liner, and intensity.",
    ],
    ui: [
      { callout: "Eyelid · eye shape · lips · face shape · brows" },
      { callout: "<b>10 units</b> per analysis. Tap a card to correct it, <b>0 units</b>." },
      { callout: "Base shade: measured from the cheeks on the device." },
      { callout: "<b>Double lid</b> → crease shading + thin liner<br><span class=\"mono\">2colors3 · Upper11</span>" },
    ],
    timeline: [
      { at: 0, src: [0, 1.2] },
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
    kicker: "Two faces, one lesson",
    heading: "Same look, different technique",
    chip: "Pre-generated with the live API · 0 units now",
    note: "Both models are Pexels License stock photos",
    lines: [
      "Here's the proof. Same lesson, two different faces.",
      "A double lid gets crease shading. An inner double lid gets a soft gradient above the liner. Same look, different technique.",
      "Curious about a monolid? The what-if panel shows that branch too, for zero units.",
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
      "Now it's your turn. Do the look for real, and snap your attempt. Here, a stock image stands in.",
      "Each region is checked against the answer by color difference: liner, lid, cheeks and lips.",
      "You get a score, one clear fix, and an honest confidence level.",
    ],
    ui: [
      { callout: "Draw it, then snap your attempt." },
      { callout: "Per-region color difference: <b>eyeliner · eyelid · cheeks · lips</b>" },
      { callout: "Score + <b>one-line correction</b> + confidence" },
    ],
    timeline: [
      { at: 0, src: [0, 2.6] },
      { at: { cue: 0, plus: 3.4 }, src: [3.9, 19.6] },
    ],
    zoom: [{ at: 0, y: 150 }, { at: { cue: 0, plus: 3.4 }, y: 120 }, { at: { cue: 1 }, y: 120 }, { at: { cue: 2 }, y: 330 }],
  },
  {
    id: "shop",
    kicker: "Step 5 · Shop the step",
    heading: "Exact colors to products",
    chip: "CIEDE2000 matching · demo catalog",
    lines: [
      "Love a color? Shop the step matches its exact shade to products, using CIEDE2000 color science.",
      "This catalog is demo data. A partner feed would plug in real products.",
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
      "Come back tomorrow, and your streak and past results are waiting, saved only on this device.",
      "Returning users skip the analysis, so a new lesson costs just four units.",
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
      { callout: "Mirror Tutor" },
    ],
    timeline: [{ at: 0, src: 2 }, { at: { cue: 1 }, src: 12 }],
    zoom: [{ at: 0, y: 60 }, { at: { cue: 1 }, y: 420 }],
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
  let t = LEAD;
  const lead = path.join(dir, `${seg.id}-lead.wav`);
  silence(LEAD, lead);
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

// left-column step list (one entry per segment after the intro)
const FLOW = ["Capture", "Analyze", "Learn", "Two faces", "Grade", "Shop", "Streak", "Share"];

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
  .flow{position:absolute;left:64px;bottom:128px;width:${SCR_X - 64 - 52}px}
  .flow .fh{font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b605c;margin-bottom:12px}
  .flow ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
  .flow li{display:flex;align-items:center;gap:10px;height:42px;padding:0 14px;border-radius:12px;border:2px solid #eadfd8;background:#fff;font-size:20px;font-weight:600;color:#9a8f8b}
  .flow li i{font-style:normal;flex:none;width:24px;height:24px;border-radius:12px;display:grid;place-items:center;font-size:14px;font-weight:800;background:#f1e9e4;color:#6b605c}
  .flow li.done{color:#4a403d}.flow li.done i{background:#d9ece2;color:#2f7a55}
  .flow li.now{background:#c8325b;border-color:#c8325b;color:#fff;box-shadow:0 6px 16px rgba(200,50,91,.25)}.flow li.now i{background:#fff;color:#a8264a}
  .foot{position:absolute;left:64px;width:${SCR_X - 64 - 52}px;bottom:26px;font-size:17px;line-height:1.35;color:#6b605c}
  </style></head><body>
  <div class="phone"></div><div class="zoom"></div><div class="zlabel">Zoom on the app</div>
  <div class="left"><div class="kick">${esc(seg.kicker)}</div><h1>${esc(ui.heading)}</h1><div class="chip">${esc(ui.chip)}</div>${ui.callout ? `<div class="callout">${ui.callout}</div>` : ""}${seg.note ? `<div class="note">${esc(seg.note)}</div>` : ""}</div>
  <div class="sub">${esc(cue)}</div>
  <div class="flow"><div class="fh">${si === 0 ? "How it works" : `Step ${Math.min(si, FLOW.length)} of ${FLOW.length}`}</div><ol>${FLOW.map((f, i) => {
    const st = i + 1 < si ? "done" : i + 1 === si ? "now" : "";
    return `<li class="${st}"><i>${st === "done" ? "✓" : i + 1}</i>${esc(f)}</li>`;
  }).join("")}</ol></div>
  <div class="bar"><i></i></div>
  <div class="foot">Mirror Tutor · recorded against the live YouCam API<br>Sample faces: Pexels License stock photos · demo catalog</div>
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

function planShots(seg, items, total) {
  const anchors = seg.timeline.map((a) => ({ t: resolveAt(seg, a.at), src: a.src })).sort((a, b) => a.t - b.t);
  const N = Math.round(seg.duration * FPS);
  anchors.forEach((a, k) => {
    a.i0 = Math.ceil(a.t * FPS - 1e-6);
    const next = anchors[k + 1]?.t ?? seg.duration;
    if (Array.isArray(a.src)) a.pieces = rangePieces(items, total, a.src[0], a.src[1], next - a.t);
  });
  const fr = [];
  let k = 0;
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    while (k + 1 < anchors.length && anchors[k + 1].i0 <= i) k++;
    const a = anchors[k];
    if (!a.pieces) fr.push(frameAt(items, a.src));
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
  const { items, total } = loadSourceFrames(seg.id);
  const { fr, cuts, N } = planShots(seg, items, total);
  const dur = seg.duration;
  const hN = XF_N / 2;
  const bounds = [0, ...cuts, N];
  const bgList = path.join(dir, `${seg.id}-stage.txt`);
  concatList(bgList, seg.stage.map((f, i) => ({ file: f, start: i === 0 ? 0 : seg.cues[i].start })), dur);

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
    `[b1][zm]overlay=${ZX}:${ZY}:eof_action=repeat,format=yuv420p[v]`,
    `[1:a]apad[a]`,
  );
  const fs = path.join(dir, `${seg.id}-filter.txt`);
  writeFileSync(fs, filter.join(";\n"));
  const out = path.join(dir, `${seg.id}.mp4`);
  const loop = (f) => ["-loop", "1", "-framerate", String(FPS), "-t", (dur + 1).toFixed(2), "-i", f];
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", bgList, "-i", seg.audio, ...loop(masks.phone), ...loop(masks.zoom), ...inputs, "-filter_complex_script", fs, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out]);
  seg.cutTimes = cutT;
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
  await buildAudio(seg, audioDir);
  if (ONLY && !ONLY.includes(seg.id)) continue;
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
