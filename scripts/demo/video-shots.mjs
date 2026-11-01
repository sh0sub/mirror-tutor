/**
 * Shot list + narration for the faceless demo video (read by scripts/demo/record-video.mjs).
 *
 * Each segment = one narrated shot. The segment lasts as long as its narration audio (+ padding);
 * `actions` run in order while the phone screen is recorded:
 *   { at: n, plus?: s }            wait until narration line n (0-based) starts (+ s seconds)
 *   { sleep: s }                   hold
 *   { tap: { sel, text? } }        tap the first visible element matching the selector (+ text regex)
 *   { wait: "js", fail?: "js", cut?: true, timeout?: ms }
 *                                  poll a page expression; `fail` aborts the run (no retries, matters in
 *                                  live mode); `cut` removes the waiting time from the video (keeps ~0.8 s)
 *   { scroll: { y } | { sel, text?, offset? }, dur? }   smooth window scroll
 *   { upload: "repo/relative/path.jpg" }               set the capture page's hidden file input (CDP)
 *   { drag: { sel, from, to, dur? } }                  horizontal drag across an element (fractions)
 *   { route: "/path" }             client-side navigation (keeps in-memory photo/renders)
 *   { key: "Escape" }
 *   { save: { name, js } }         store a page value; "{name}" in later route strings is replaced
 *   { scrollPast: "selector" }     scroll that element up behind the sticky app bar (no-op if absent); later
 *                                  { scroll: { y } } in the segment are offset by the same amount
 * `prep` runs before the segment starts recording (not shown).
 * Lines are spoken with macOS `say` and burned in as subtitles; keep them short (one subtitle each).
 */

const bodyHas = (s) => `document.body.innerText.includes(${JSON.stringify(s)})`;

export const PHOTO = "public/demo/model-a/original.jpg"; // Pexels License stock photo
export const ATTEMPT = "public/demo/model-a/step-3.jpg"; // stand-in attempt: eyes done, lips skipped, so grading shows a real correction

export const SEGMENTS = [
  {
    id: "intro",
    kicker: "Mirror Tutor",
    heading: "Makeup lessons on your own face",
    chip: "YouCam AI Face Analyzer + Makeup Virtual Try-On",
    lines: [
      "Makeup tutorials are filmed on someone else's face.",
      "Mirror Tutor teaches makeup on yours.",
      "It reads your features, renders every step on your own photo as the answer key, and grades your real attempt.",
    ],
    actions: [{ wait: "document.querySelector('main h2')", timeout: 30000 }, { at: 2 }, { scroll: { y: 260 }, dur: 1.4 }, { sleep: 2.2 }, { scroll: { y: 0 }, dur: 1.2 }],
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
    actions: [
      { sleep: 0.6 },
      { tap: { sel: "button", text: "^Get started$" } },
      { at: 1, plus: 0.2 },
      { tap: { sel: "dialog[open] button", text: "Agree and start" } },
      { wait: "location.pathname === '/capture'" },
      { at: 2, plus: 1.0 },
      { tap: { sel: "button", text: "Upload photo" }, noClick: true },
      { upload: PHOTO },
      { wait: "location.pathname === '/analyze'", timeout: 20000 },
      { sleep: 0.8 },
    ],
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
      "A hand-written rule table turns each feature into a technique.",
    ],
    actions: [
      { wait: bodyHas("Analysis done"), fail: bodyHas("Analysis failed"), cut: true, timeout: 180000 },
      { wait: "!document.body.innerText.includes('Measuring')", cut: true, timeout: 30000 },
      { at: 1, plus: 1.5 },
      { scroll: { sel: "button", text: "^Base shade", offset: 260 }, dur: 1.6 },
      { at: 3 },
      { tap: { sel: "button", text: "See the rule table" } },
      { sleep: 3.2 },
      { tap: { sel: "dialog[open] button", text: "^Close$" } },
    ],
  },
  {
    id: "lesson",
    kicker: "Step 3 · Learn",
    heading: "Every step rendered on your photo",
    chip: "YouCam Makeup Virtual Try-On · 1 unit per step",
    lines: [
      "YouCam Makeup Virtual Try-On renders each lesson step on the same photo, cumulatively.",
      "That's one unit per step, four per lesson, and each render becomes the answer key.",
      "Drag to compare before and after.",
      "Each step explains why it fits this face, and lists the exact colors it uses.",
    ],
    prep: [{ scroll: { y: 0 }, dur: 0.1 }],
    actions: [
      { tap: { sel: "button", text: "Start this lesson" } },
      { wait: "location.pathname === '/lesson'" },
      { save: { name: "lesson", js: "new URLSearchParams(location.search).get('id') || 'daily-k'" } },
      { wait: "document.querySelectorAll('nav[aria-label] button').length >= 4 && !!document.querySelector('img[alt^=\"Answer\"]') && !document.body.innerText.includes('Rendering')", fail: bodyHas("This step failed") + " || " + bodyHas("Session unit limit"), cut: true, timeout: 420000 },
      { at: 2 },
      { drag: { sel: "[role=slider]", parent: true, from: 0.5, to: 0.12, dur: 0.8 } },
      { drag: { sel: "[role=slider]", parent: true, from: 0.12, to: 0.88, dur: 1.1 } },
      { drag: { sel: "[role=slider]", parent: true, from: 0.88, to: 0.5, dur: 0.6 } },
      { at: 3 },
      { tap: { sel: "button", text: "^Next step$" } },
      { sleep: 0.6 },
      { tap: { sel: "button", text: "^Next step$" } },
      { sleep: 0.5 },
      { scroll: { sel: "button", text: "^Why this fits you", offset: 200 }, dur: 1.0 },
      { sleep: 0.8 },
    ],
  },
  {
    id: "compare",
    kicker: "Two faces, one lesson",
    heading: "Same look, different technique",
    chip: "Pre-generated with the live API · 0 units now",
    note: "Both models are Pexels License stock photos",
    lines: [
      "The compare page shows the same lesson on two pre-generated stock faces.",
      "Their eyelids differ, so the rule table picks a different technique for each, and the try-on shows it.",
      "A what-if panel previews other branches, like a monolid, as rule-table text for zero units.",
    ],
    prep: [{ route: "/compare" }, { wait: "location.pathname === '/compare' && document.querySelectorAll('figure img').length >= 2" }, { sleep: 1.2 }],
    actions: [
      { sleep: 0.8 },
      { tap: { sel: "button[role=tab]:nth-child(3)" } },
      { sleep: 0.8 },
      { tap: { sel: "button", text: "Show original" } },
      { sleep: 1.2 },
      { tap: { sel: "button", text: "Show answer" } },
      { at: 1 },
      { scroll: { sel: "#rules", offset: 120 }, dur: 1.6 },
      { at: 2 },
      { scroll: { sel: "#whatif", offset: 300 }, dur: 1.4 },
      { tap: { sel: "button[aria-pressed]", text: "^Monolid$" } },
      { sleep: 2.0 },
    ],
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
    prep: [
      { route: "/lesson?id={lesson}" },
      { wait: "location.pathname === '/lesson' && !!document.querySelector('[role=slider]')" },
      { tap: { sel: "nav[aria-label] button:nth-child(4)" }, quiet: true },
      { sleep: 0.8 },
    ],
    actions: [
      { sleep: 0.6 },
      { tap: { sel: "a", text: "Snap your attempt" } },
      { wait: "location.pathname === '/capture'" },
      { sleep: 1.0 },
      { tap: { sel: "button", text: "Upload photo" }, noClick: true },
      { upload: ATTEMPT },
      { wait: "location.pathname === '/grade'", timeout: 20000 },
      { wait: bodyHas("Graded") + " || " + bodyHas("Angle is quite different"), fail: bodyHas("Analysis failed"), cut: true, timeout: 180000 },
      { at: 2 },
      { scroll: { y: 360 }, dur: 1.6 },
      { sleep: 2.0 },
    ],
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
    actions: [
      { tap: { sel: "a", text: "See products" } },
      { wait: "location.pathname === '/shop' && !!document.querySelector('section[aria-label] button[aria-pressed]')" },
      { scrollPast: "header ~ p[role=status]" }, // mock/sample banner (absent in live mode) goes behind the app bar
      { sleep: 1.6 },
      { tap: { sel: "section[aria-label] button[aria-pressed]" } },
      { sleep: 1.2 },
      { tap: { sel: "button[aria-label^='Add']" } },
      { sleep: 0.6 },
      { tap: { sel: "button", text: "View in store" } },
      { sleep: 1.6 },
      { tap: { sel: "dialog[open] button", text: "^Cancel$" } },
      { at: 1 },
      { scroll: { y: 420 }, dur: 1.6 },
      { sleep: 1.5 },
    ],
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
    prep: [{ route: "/" }, { wait: "location.pathname === '/' && document.body.innerText.includes('streak')" }, { sleep: 1.0 }],
    actions: [{ sleep: 1.0 }, { scroll: { y: 330 }, dur: 1.4 }, { at: 1 }, { sleep: 1.5 }, { scroll: { y: 0 }, dur: 1.0 }],
  },
  {
    id: "share",
    kicker: "Share",
    heading: "Private by default",
    chip: "Photos never stored · units capped per session",
    lines: [
      "The share card is drawn on the device, with faces blurred by default.",
      "Photos are never stored, and YouCam units are capped per session.",
      "Mirror Tutor: learn makeup on your own face.",
    ],
    prep: [{ route: "/share?lesson={lesson}" }, { wait: "location.pathname === '/share'" }, { sleep: 2.0 }],
    actions: [{ sleep: 1.5 }, { at: 1, plus: 0.5 }, { scroll: { y: 300 }, dur: 1.4 }, { sleep: 1.0 }, { scroll: { y: 0 }, dur: 1.2 }],
  },
];

/**
 * `record-video.mjs --mode mock --sample --only shop`: reach the graded state through "Try with a sample model"
 * (Model A's pre-generated live results, 0 units) instead of the live capture/analyze/lesson/grade shots.
 * Ends where the live "grade" shot ends (daily-k, step 4, graded, scrolled to the shop button).
 */
export const SAMPLE_SETUP = [
  { wait: "document.querySelector('main h2')", timeout: 30000 },
  { tap: { sel: "button", text: "^Try with a sample model" }, quiet: true },
  { wait: "location.pathname === '/analyze'", timeout: 20000 },
  { wait: bodyHas("Analysis done"), fail: bodyHas("Analysis failed"), timeout: 60000 },
  { tap: { sel: "button", text: "Start this lesson" }, quiet: true },
  { wait: "location.pathname === '/lesson'" },
  { wait: "document.querySelectorAll('nav[aria-label] button').length >= 4 && !!document.querySelector('img[alt^=\"Answer\"]') && !document.body.innerText.includes('Rendering')", fail: bodyHas("This step failed"), timeout: 60000 },
  { tap: { sel: "nav[aria-label] button:nth-child(4)" }, quiet: true },
  { sleep: 1.0 },
  { tap: { sel: "button", text: "^Grade a sample try" }, quiet: true },
  { wait: "location.pathname === '/grade'", timeout: 20000 },
  { wait: bodyHas("Graded") + " || " + bodyHas("Angle is quite different"), fail: bodyHas("Analysis failed"), timeout: 60000 },
  { sleep: 1.0 },
  { scroll: { y: 360 }, dur: 1.2 },
  { sleep: 0.8 },
];
