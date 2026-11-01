#!/usr/bin/env node
/**
 * Faceless demo video recorder: drives the real app in headless Chrome (raw CDP, no extra deps),
 * records the 390-wide mobile viewport, narrates each shot with macOS `say`, burns in subtitles
 * and writes one 1920x1080 MP4.
 *
 *   node scripts/demo/record-video.mjs --mode mock            # local overlay renderer, 0 units
 *   node scripts/demo/record-video.mjs --mode live            # real YouCam API (~14 units), keys from .env
 *
 * Options: --port 3611  --work <dir for frames/audio>  --out <mp4>  --base <url of a running server>
 *          --setup full      (mock, with --only) first run the upload flow in mock mode (capture -> analyze -> lesson -> graded try)
 *                            so the home screen shows a returning user with a stored profile
 *          --voice Samantha  --rate 150  --stills 6
 *          --only shop[,id]  record just these segments (re-take one shot for recomposite.mjs); with --sample the
 *                            state is reached through the "Try with a sample model" flow (the sample model's pre-generated
 *                            live results, 0 units) using SAMPLE_SETUP from video-shots.mjs, recorded nowhere.
 *                            Writes <work>/frames-<id> + <work>/segments/<id>-phone.txt (no audio/stage/MP4).
 * Without --base it starts `next dev` on --port with YOUCAM_MODE=<mode> on the command line (overrides
 * .env) and stops it at the end. Mock mode also blanks ANTHROPIC_API_KEY so grading uses local rules.
 * Live mode aborts unless GET /api/credit says mode "live", not demo, remaining >= 150; it never retries
 * a failed step, and aborts if the session spends more than 20 units.
 * Needs: Google Chrome, ffmpeg/ffprobe, macOS `say`. Shot list + narration: scripts/demo/video-shots.mjs.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SEGMENTS as ALL_SEGMENTS, SAMPLE_SETUP, SAMPLE_SETUP_LESSON, FULL_SETUP } from "./video-shots.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"]] : acc), []),
);
const MODE = args.mode === "live" ? "live" : "mock";
const PORT = Number(args.port ?? 3611);
const BASE = args.base ?? `http://localhost:${PORT}`;
const WORK = path.resolve(args.work ?? path.join(ROOT, `.local/video/work-${MODE}`));
const OUT = path.resolve(args.out ?? path.join(ROOT, `.local/video/mirror-tutor-demo-${MODE}.mp4`));
const VOICE = args.voice ?? "Samantha";
const ONLY = args.only ? String(args.only).split(",") : null;
const SAMPLE = !!args.sample;
// --fake-cam <mjpeg/y4m>: Chrome plays that file as the camera (a licensed stock photo), so /capture shows the real quality gate
const FAKE_CAM = args["fake-cam"] ? path.resolve(args["fake-cam"]) : null;
if (SAMPLE && (!ONLY || MODE !== "mock")) throw new Error("--sample needs --only and --mode mock");
const SEGMENTS = ONLY ? ALL_SEGMENTS.filter((s) => ONLY.includes(s.id)) : ALL_SEGMENTS;
const RATE = Number(args.rate ?? 150);
const STILLS = Number(args.stills ?? 6);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";
const FFPROBE = existsSync("/opt/homebrew/bin/ffprobe") ? "/opt/homebrew/bin/ffprobe" : "ffprobe";
const LIVE_MIN_REMAINING = 150;
const LIVE_MAX_SPEND = 20;

// Layout (1920x1080): phone screen centered, heading on the left, subtitle on the right.
const W = 1920, H = 1080, FPS = 30;
const VW = 390, VH = 844, DPR = 2; // recorded viewport (CSS px) and device scale
const SCR_H = 1000, SCR_W = Math.round((SCR_H * VW) / VH); // 462
const SCR_X = Math.round((W - SCR_W) / 2), SCR_Y = 40;
const LEAD = 0.5, GAP = 0.35, TAIL = 1.0, CUT_KEEP = 0.8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[rec ${new Date().toISOString().slice(11, 19)}]`, ...a);
const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).toString();
const probe = (f) => Number(run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cleanup = [];
async function shutdown(code) {
  for (const fn of cleanup.reverse()) {
    try {
      await fn();
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => void shutdown(130));

/* ── 1. narration audio (one file per line → exact subtitle timing) ───────────── */
function buildAudio() {
  const dir = path.join(WORK, "audio");
  mkdirSync(dir, { recursive: true });
  const silence = (sec, f) => run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", sec.toFixed(3), "-c:a", "pcm_s16le", f]);
  for (const seg of SEGMENTS) {
    const parts = [];
    const cues = [];
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
      cues.push({ start: t, end: t + d, text: line });
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
    t += TAIL;
    const list = path.join(dir, `${seg.id}-list.txt`);
    writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
    seg.audio = path.join(dir, `${seg.id}.wav`);
    run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", seg.audio]);
    seg.cues = cues;
    seg.audioDur = probe(seg.audio);
    log(`audio ${seg.id}: ${seg.audioDur.toFixed(2)}s, ${seg.lines.join(" ").split(/\s+/).length} words`);
  }
}

/* ── CDP plumbing ──────────────────────────────────────────────────────────── */
async function launchChrome() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = path.join(WORK, "chrome-profile");
  rmSync(profile, { recursive: true, force: true }); // fresh: no stored profile, no consent
  const proc = spawn(CHROME, ["--headless=new", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${VW},${VH}`, "--lang=en-US", ...(FAKE_CAM ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${FAKE_CAM}`] : []), "about:blank"], { stdio: "ignore" });
  cleanup.push(() => proc.kill("SIGKILL"));
  let wsUrl;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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
  const pending = new Map();
  const listeners = new Map();
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) rej(new Error(`${d.error.message} ${d.error.data ?? ""}`));
      else res(d.result);
    } else if (d.method) listeners.get(d.method)?.forEach((fn) => fn(d.params));
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      sock.send(JSON.stringify({ id: i, method, params }));
    });
  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);
  return { send, on };
}

/* ── 2. stage graphics (one RGBA PNG per subtitle cue, transparent phone-screen hole) ── */
function stageHtml(seg, idx, cueText) {
  const total = SEGMENTS.length;
  const modeLabel = MODE === "live" ? "Recorded against the live YouCam API" : "Recorded in mock mode (local preview overlay, no YouCam calls)";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1f1b1a;-webkit-font-smoothing:antialiased}
  .hole{position:absolute;left:${SCR_X}px;top:${SCR_Y}px;width:${SCR_W}px;height:${SCR_H}px;border-radius:34px;box-shadow:0 0 0 14px #1f1b1a,0 0 0 15px #3a3331,0 30px 60px 14px rgba(31,27,26,.28),0 0 0 3000px #fbf7f4}
  .left{position:absolute;left:110px;top:0;bottom:0;width:${SCR_X - 200}px;display:flex;flex-direction:column;justify-content:center;gap:26px;z-index:2}
  .kick{font-size:24px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8264a}
  .count{font-size:22px;font-weight:600;color:#6b605c;font-variant-numeric:tabular-nums}
  h1{margin:0;font-size:58px;line-height:1.08;font-weight:800;letter-spacing:-.01em}
  .chip{align-self:flex-start;background:#fcebe3;color:#a8264a;border-radius:999px;padding:14px 24px;font-size:24px;font-weight:700;line-height:1.25}
  .note{font-size:21px;color:#6b605c;line-height:1.4}
  .right{position:absolute;left:${SCR_X + SCR_W + 90}px;right:110px;top:0;bottom:0;display:flex;align-items:center;z-index:2}
  .sub{border-left:6px solid #c8325b;padding:6px 0 6px 28px;font-size:40px;line-height:1.36;font-weight:600}
  .foot{position:absolute;left:110px;right:110px;bottom:30px;display:flex;justify-content:space-between;align-items:flex-end;font-size:18px;line-height:1.35;color:#6b605c;z-index:2}.foot span{max-width:${SCR_X - 200}px}.foot span+span{text-align:right}
  .bar{position:absolute;left:110px;bottom:96px;width:${SCR_X - 200}px;height:6px;border-radius:3px;background:#eadfd8;z-index:2}
  .bar i{display:block;height:6px;border-radius:3px;background:#c8325b;width:${(((idx + 1) / total) * 100).toFixed(1)}%}
  </style></head><body>
  <div class="hole"></div>
  <div class="left"><div class="kick">${esc(seg.kicker)}</div><h1>${esc(seg.heading)}</h1><div class="chip">${esc(seg.chip)}</div>${seg.note ? `<div class="note">${esc(seg.note)}</div>` : ""}</div>
  <div class="right">${cueText ? `<div class="sub">${esc(cueText)}</div>` : ""}</div>
  <div class="bar"><i></i></div>
  <div class="foot"><span>Mirror Tutor · ${esc(modeLabel)}</span><span>Sample faces: Pexels License stock photos · demo catalog</span></div>
  </body></html>`;
}

async function renderStage(cdp) {
  const dir = path.join(WORK, "stage");
  mkdirSync(dir, { recursive: true });
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const [si, seg] of SEGMENTS.entries()) {
    seg.stage = [];
    for (const [ci, cue] of seg.cues.entries()) {
      const html = path.join(dir, `${seg.id}-${ci}.html`);
      const png = path.join(dir, `${seg.id}-${ci}.png`);
      writeFileSync(html, stageHtml(seg, si, cue.text));
      await cdp.send("Page.navigate", { url: `file://${html}` });
      await sleep(250);
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(png, Buffer.from(shot.data, "base64"));
      seg.stage.push(png);
    }
  }
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", {});
  log(`stage graphics: ${SEGMENTS.reduce((n, s) => n + s.stage.length, 0)} PNGs`);
}

/* ── 3. dev server ─────────────────────────────────────────────────────────── */
async function startServer() {
  if (args.base) return;
  try {
    await fetch(`${BASE}/api/credit`);
    throw new Error(`port ${PORT} is already in use; stop that server or pass --base`);
  } catch (e) {
    if (String(e.message).startsWith("port")) throw e;
  }
  const env = { ...process.env, YOUCAM_MODE: MODE, NEXT_TELEMETRY_DISABLED: "1" };
  if (MODE === "mock") env.ANTHROPIC_API_KEY = ""; // empty wins over .env → local rule-based tips, no paid calls
  const logFile = path.join(WORK, `next-dev-${MODE}.log`);
  const fd = openSync(logFile, "w");
  const proc = spawn("npx", ["next", "dev", "-p", String(PORT)], { cwd: ROOT, env, detached: true, stdio: ["ignore", fd, fd] });
  cleanup.push(() => {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/api/credit`)).ok) break;
    } catch {
      /* booting */
    }
    await sleep(500);
  }
  log(`next dev (${MODE}) on ${BASE}, log ${logFile}`);
  // warm up route compilation so first visits are not blank in the recording
  for (const p of ["/", "/capture", "/analyze", "/lesson", "/compare", "/grade", "/shop", "/share"]) await fetch(BASE + p).catch(() => null);
}

/* ── 4. recording ──────────────────────────────────────────────────────────── */
async function record(cdp) {
  const framesDir = path.join(WORK, ONLY ? `frames-${ONLY.join("-")}` : "frames");
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const frames = []; // { file, wall }
  let n = 0;
  cdp.on("Page.screencastFrame", (p) => {
    const file = path.join(framesDir, `f${String(++n).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(p.data, "base64"));
    frames.push({ file, wall: p.metadata?.timestamp ? p.metadata.timestamp * 1000 : Date.now() });
    void cdp.send("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => null);
  });

  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true });
  await cdp.send("Emulation.setLocaleOverride", { locale: "en-US" }).catch(() => null);
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{localStorage.setItem('mt.lang','en')}catch(e){}
      document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.appendChild(s)});`,
  });
  await cdp.send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);

  const evaluate = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const credit = () => evaluate("fetch('/api/credit').then(r=>r.json())");

  const before = await credit();
  log("credit before:", JSON.stringify(before));
  if (before.mode !== MODE) throw new Error(`server mode is "${before.mode}", expected "${MODE}"`);
  if (MODE === "live" && (before.demo || before.remaining === null || before.remaining < LIVE_MIN_REMAINING)) {
    throw new Error(`live take aborted: remaining=${before.remaining} demo=${before.demo} (need >= ${LIVE_MIN_REMAINING})`);
  }

  const vars = {};
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 });
  await sleep(800);

  const findJs = (sel, text, parent) => `(() => {
    const re = ${text ? `new RegExp(${JSON.stringify(text)}, 'i')` : "null"};
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      return !re || re.test((e.innerText || e.textContent || '').trim()) || re.test(e.getAttribute('aria-label') || '');
    });
    let el = els[0];
    if (!el) return null;
    if (${parent ? "true" : "false"}) el = el.parentElement;
    let r = el.getBoundingClientRect();
    if ((r.bottom > innerHeight - 100 || r.top < 60) && !el.closest('dialog, .sticky')) { el.scrollIntoView({ block: 'center' }); r = el.getBoundingClientRect(); }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top + scrollY };
  })()`;
  const find = async (sel, text, parent, timeout = 15000) => {
    const t0 = Date.now();
    for (;;) {
      const r = await evaluate(findJs(sel, text, parent));
      if (r) return r;
      if (Date.now() - t0 > timeout) throw new Error(`element not found: ${sel} ${text ?? ""}`);
      await sleep(200);
    }
  };
  const ripple = (x, y) =>
    evaluate(`(() => { const d = document.createElement('div'); d.setAttribute('popover','manual');
      d.style.cssText = 'position:fixed;inset:auto;margin:0;padding:0;border:0;left:${x - 24}px;top:${y - 24}px;width:48px;height:48px;border-radius:50%;background:rgba(200,50,91,.35);box-shadow:0 0 0 3px rgba(255,255,255,.9);pointer-events:none;transition:transform .5s ease-out,opacity .5s ease-out;overflow:visible';
      document.body.appendChild(d); try { d.showPopover(); } catch (e) {}
      requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = 'scale(1.7)'; d.style.opacity = '0'; }));
      setTimeout(() => d.remove(), 700); })()`);
  const mouse = (type, x, y, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse", ...extra });

  let segStart = 0;
  let cuts = [];
  const visible = (now = Date.now()) => {
    let v = now - segStart;
    for (const [a, b] of cuts) v -= Math.max(0, Math.min(now, b) - a);
    return v / 1000;
  };
  const failOn = (expr) => (expr ? evaluate(`!!(${expr})`) : false);

  async function act(a, seg, recording) {
    if (a.at !== undefined) {
      const target = seg.cues[a.at].start + (a.plus ?? 0);
      while (recording && visible() < target) await sleep(30);
    } else if (a.sleep !== undefined) await sleep(a.sleep * 1000);
    else if (a.tap) {
      const r = await find(a.tap.sel, a.tap.text);
      if (!a.quiet) await ripple(r.x, r.y);
      if (!a.noClick) {
        await mouse("mouseMoved", r.x, r.y, { buttons: 0 });
        await mouse("mousePressed", r.x, r.y);
        await sleep(60);
        await mouse("mouseReleased", r.x, r.y);
      }
      await sleep(250);
    } else if (a.wait) {
      const t0 = Date.now();
      for (;;) {
        if (await failOn(a.fail)) throw new Error(`failure state while waiting in "${seg?.id ?? "setup"}" (${a.fail}) — not retrying`);
        if (await evaluate(`!!(${a.wait})`)) break;
        if (Date.now() - t0 > (a.timeout ?? 15000)) throw new Error(`timeout in "${seg?.id ?? "setup"}": ${a.wait}`);
        await sleep(150);
      }
      const t1 = Date.now();
      if (a.cut && recording && t1 - t0 > CUT_KEEP * 1000 + 100) {
        cuts.push([t0 + CUT_KEEP * 1000, t1]);
        log(`  cut ${((t1 - t0) / 1000 - CUT_KEEP).toFixed(1)}s of waiting in ${seg?.id}`);
      }
    } else if (a.scrollPast) {
      // scroll an element (e.g. the mock/sample mode banner) up behind the sticky app bar; no-op when absent
      const off = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(a.scrollPast)}); if (!e) return 0;
        const r = e.getBoundingClientRect(); const bar = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
        return Math.max(0, Math.ceil(r.bottom + scrollY + parseFloat(getComputedStyle(e).marginBottom || 0) - bar)); })()`);
      vars.__yoff = off;
      if (off) await evaluate(`window.scrollTo({ top: ${off}, behavior: 'instant' })`);
      log(`  scrollPast ${a.scrollPast}: ${off}px`);
      await sleep((a.dur ?? 0) * 1000);
    } else if (a.scroll) {
      let y = a.scroll.y === undefined ? undefined : a.scroll.y + (vars.__yoff ?? 0);
      if (y === undefined) {
        const r = await find(a.scroll.sel, a.scroll.text);
        y = Math.max(0, r.top - VH + (a.scroll.offset ?? 200) + r.h);
      }
      await evaluate(`window.scrollTo({ top: ${y}, behavior: 'smooth' })`);
      await sleep((a.dur ?? 1) * 1000);
    } else if (a.upload) {
      const { root } = await cdp.send("DOM.getDocument", { depth: 1 });
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file]" });
      if (!nodeId) throw new Error("file input not found");
      await cdp.send("DOM.setFileInputFiles", { nodeId, files: [path.join(ROOT, a.upload)] });
      await sleep(300);
    } else if (a.drag) {
      const r = await find(a.drag.sel, a.drag.text, a.drag.parent);
      const left = r.x - r.w / 2;
      const steps = Math.max(8, Math.round((a.drag.dur ?? 1) * 40));
      const x0 = left + r.w * a.drag.from, x1 = left + r.w * a.drag.to;
      await mouse("mouseMoved", x0, r.y, { buttons: 0 });
      await mouse("mousePressed", x0, r.y);
      for (let i = 1; i <= steps; i++) {
        const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        await mouse("mouseMoved", x0 + (x1 - x0) * e, r.y);
        await sleep(((a.drag.dur ?? 1) * 1000) / steps);
      }
      await mouse("mouseReleased", x1, r.y);
      await sleep(400); // > double-tap window of the slider
    } else if (a.route) {
      const p = a.route.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
      await evaluate(`window.next.router.push(${JSON.stringify(p)})`);
      await sleep(500);
    } else if (a.js) {
      await evaluate(a.js);
    } else if (a.key) {
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: a.key, code: a.key, windowsVirtualKeyCode: a.key === "Escape" ? 27 : 0 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: a.key, code: a.key, windowsVirtualKeyCode: a.key === "Escape" ? 27 : 0 });
    } else if (a.save) {
      vars[a.save.name] = await evaluate(a.save.js);
      log(`  ${a.save.name} = ${vars[a.save.name]}`);
    } else throw new Error(`unknown action ${JSON.stringify(a)}`);
  }

  // not part of any segment's timeline: frames before segStart are never used
  if (SAMPLE) {
    // a segment with a `sample` variant starts from the lesson (step 4), the others from the graded state
    for (const a of SEGMENTS.some((x) => x.sample) ? SAMPLE_SETUP_LESSON : SAMPLE_SETUP) await act(a, null, false);
    vars.lesson = "daily-k"; // the sample lesson, for later `{lesson}` routes (home/share/grade)
    log("sample setup done:", await evaluate("location.pathname + location.search"));
  }

  if (args.setup === "full") {
    // mock-mode upload flow (own photo path, a stored profile and a graded try), so `home` shows a returning user
    for (const a of FULL_SETUP) await act(a, null, false);
    log("full setup done:", await evaluate("location.pathname + location.search"));
  }

  for (const seg of SEGMENTS) {
    for (const a of (SAMPLE && seg.sample?.prep) || seg.prep || []) await act(a, seg, false);
    await sleep(400);
    cuts = [];
    vars.__yoff = 0;
    segStart = Date.now();
    const seed = frames.at(-1); // screen as it is when the segment starts
    for (const a of (SAMPLE && seg.sample?.actions) || seg.actions) await act(a, seg, true);
    const target = seg.audioDur;
    if (visible() > target) log(`  WARN ${seg.id}: actions took ${visible().toFixed(2)}s > narration ${target.toFixed(2)}s (silence padded)`);
    while (visible() < target) await sleep(30);
    const end = Date.now();
    seg.duration = Math.max(target, visible(end));
    // map wall-clock frames into the cut-adjusted segment timeline
    const segFrames = [];
    if (seed) segFrames.push({ file: seed.file, v: 0 });
    for (const f of frames) {
      if (f.wall < segStart || f.wall > end) continue;
      segFrames.push({ file: f.file, v: Math.max(0, visible(f.wall)) });
    }
    seg.frames = segFrames;
    if (MODE === "live") {
      const c = await credit();
      log(`  credit after ${seg.id}: sessionSpent=${c.sessionSpent} remaining=${c.remaining}`);
      if (c.sessionSpent > LIVE_MAX_SPEND) throw new Error(`live budget exceeded (${c.sessionSpent} > ${LIVE_MAX_SPEND})`);
    }
    log(`segment ${seg.id}: ${seg.duration.toFixed(2)}s, ${segFrames.length} frames`);
  }
  await cdp.send("Page.stopScreencast");
  const after = await credit();
  log("credit after:", JSON.stringify(after));
  return { before, after };
}

/* ── 5. encode ─────────────────────────────────────────────────────────────── */
function concatList(file, items, total) {
  // items: [{ file, start }] sorted; each shown until the next start
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

function encode() {
  const dir = path.join(WORK, "segments");
  mkdirSync(dir, { recursive: true });
  const outs = [];
  for (const seg of SEGMENTS) {
    const dur = seg.duration;
    // phone frames → CFR timeline (latest frame at or before each tick)
    const fr = [...seg.frames].sort((a, b) => a.v - b.v);
    const ticks = [];
    let j = 0;
    let cur = fr[0];
    for (let i = 0; i < Math.round(dur * FPS); i++) {
      const t = i / FPS;
      while (j < fr.length && fr[j].v <= t) cur = fr[j++];
      if (!ticks.length || ticks.at(-1).file !== cur.file) ticks.push({ file: cur.file, start: t });
    }
    const phoneList = path.join(dir, `${seg.id}-phone.txt`);
    concatList(phoneList, ticks, dur);
    if (ONLY) {
      log(`wrote ${phoneList} (${dur.toFixed(2)}s)`);
      continue;
    }
    const bgList = path.join(dir, `${seg.id}-stage.txt`);
    concatList(bgList, seg.stage.map((f, i) => ({ file: f, start: i === 0 ? 0 : seg.cues[i].start })), dur);
    const out = path.join(dir, `${seg.id}.mp4`);
    const filter = [
      `color=c=0x1f1b1a:s=${W}x${H}:r=${FPS}:d=${dur.toFixed(3)}[base]`,
      `[1:v]scale=${SCR_W}:${SCR_H}:flags=lanczos,setsar=1,fps=${FPS}[scr]`,
      `[base][scr]overlay=${SCR_X}:${SCR_Y}:eof_action=repeat[b1]`,
      `[0:v]format=rgba,fps=${FPS}[stage]`,
      `[b1][stage]overlay=0:0:eof_action=repeat,format=yuv420p[v]`,
      `[2:a]apad[a]`,
    ].join(";");
    run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", bgList, "-f", "concat", "-safe", "0", "-i", phoneList, "-i", seg.audio, "-filter_complex", filter, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out]);
    outs.push(out);
    log(`encoded ${seg.id} (${dur.toFixed(2)}s)`);
  }
  if (ONLY) return null;
  mkdirSync(path.dirname(OUT), { recursive: true });
  const list = path.join(dir, "all.txt");
  writeFileSync(list, outs.map((o) => `file '${o}'`).join("\n"));
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", OUT]);
  const total = probe(OUT);
  log(`wrote ${OUT} (${total.toFixed(2)}s)`);
  if (STILLS > 0) {
    const sdir = path.join(WORK, "stills");
    rmSync(sdir, { recursive: true, force: true });
    mkdirSync(sdir, { recursive: true });
    for (let i = 0; i < STILLS; i++) {
      const t = (total * (i + 0.5)) / STILLS;
      run(FFMPEG, ["-y", "-v", "error", "-ss", t.toFixed(2), "-i", OUT, "-frames:v", "1", path.join(sdir, `still-${i + 1}.png`)]);
    }
    log(`stills: ${sdir}`);
  }
  return total;
}

/* ── main ──────────────────────────────────────────────────────────────────── */
try {
  mkdirSync(WORK, { recursive: true });
  log(`mode=${MODE} work=${WORK} out=${OUT}`);
  buildAudio();
  const cdp = await launchChrome();
  await renderStage(cdp);
  await startServer();
  const credit = await record(cdp);
  const total = encode();
  const spent = credit.before.remaining !== null && credit.after.remaining !== null ? credit.before.remaining - credit.after.remaining : null;
  if (!ONLY) writeFileSync(path.join(WORK, "summary.json"), JSON.stringify({ mode: MODE, out: OUT, totalSeconds: total, segments: SEGMENTS.map((s) => ({ id: s.id, seconds: s.duration })), credit, spent }, null, 2));
  if (ONLY) {
    log(`done (--only ${ONLY.join(",")}): session spent = ${credit.after.sessionSpent}`);
    await shutdown(0);
  }
  log(`done: ${total.toFixed(1)}s, units spent (balance diff) = ${spent}, session spent = ${credit.after.sessionSpent}`);
  await shutdown(0);
} catch (e) {
  console.error("[rec] FAILED:", e.message);
  await shutdown(1);
}
