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
 *   { js: "expr" }                 evaluate a page expression (awaited), e.g. an animated range-input change
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
    // C3: recorded with --fake-cam (a stock photo shown small, as the camera feed): consent, then the real quality gate
    // fails ("face too small"), the digital zoom brings the face past 60%, the gate turns green. Stops before the shutter
    // (a shutter tap starts the 10-unit analysis); the analyze shot opens on the finished result from the live take.
    actions: [
      { sleep: 0.6 },
      { tap: { sel: "button", text: "^Use my own selfie$" } },
      { sleep: 1.4 },
      { tap: { sel: "dialog[open] button", text: "Agree and start" } },
      { wait: "location.pathname === '/capture'" },
      { wait: bodyHas("Face width"), timeout: 20000 },
      { sleep: 3.0 },
      {
        js: `(async () => { const el = document.querySelector('input[type=range]'); if (!el) throw new Error('no zoom slider');
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const a = Number(el.value), b = Math.min(Number(el.max), 1.75);
          for (let i = 1; i <= 36; i++) { set.call(el, String(a + ((b - a) * i) / 36)); el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 40)); } })()`,
      },
      { wait: bodyHas("Looks good"), timeout: 8000 },
      { sleep: 2.2 },
      { tap: { sel: "button", text: "Take photo|Shutter|Capture" }, noClick: true },
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
    // C11 (--mode mock --sample --only analyze, 0 units): the monolid sample. The analyzer's raw reading is Double-lid, the "Fix the eyelid"
    // callout asks the visitor to correct it, the edit sheet opens, Monolid is picked, the page confirms and the rest of the flow continues.
    sample: {
      setup: "analyze",
      prep: [],
      actions: [
        { js: "document.querySelector('header ~ p[role=status]')?.remove(); window.scrollTo(0, 0)" },
        { sleep: 3.2 },
        { tap: { sel: "button", text: "^Fix the eyelid" } },
        { sleep: 2.0 },
        { tap: { sel: "label", text: "Monolid" } },
        { sleep: 3.4 },
        { scroll: { sel: "button", text: "See the rule table", offset: 420 }, dur: 1.4 },
        { sleep: 3.0 },
        { tap: { sel: "button", text: "See the rule table" } },
        { sleep: 3.4 },
        { tap: { sel: "dialog[open] button", text: "^Close$" } },
        { sleep: 0.6 },
      ],
    },
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
    sample: { setup: "fixed", prep: [{ scroll: { y: 0 }, dur: 0.1 }] }, // C11: same actions, on the corrected monolid sample (0 units)
    actions: [
      { tap: { sel: "button", text: "Start this lesson" } },
      { wait: "location.pathname === '/lesson'" },
      { save: { name: "lesson", js: "new URLSearchParams(location.search).get('id') || 'daily-k'" } },
      { wait: "document.querySelectorAll('nav[aria-label] button').length >= 4 && !!document.querySelector('img[alt^=\"Answer\"]') && !document.body.innerText.includes('Rendering')", fail: bodyHas("This step failed") + " || " + bodyHas("Session unit limit"), cut: true, timeout: 420000 },
      { js: "document.querySelector('header ~ p[role=status]')?.remove(); window.scrollTo(0, 0)" }, // C11: no sample/mock banner (absent in live)
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
    // C12 cold open (--mode live --only cold --base <local live server>, 0 units, home screen only): the home hero is now the bare -> full look
    // slider (real YouCam Makeup VTO result, lesson step 4, on the monolid sample). The slider is swept in the first seconds. Only used with --only.
    id: "cold",
    sampleOnly: true,
    kicker: "Cold open",
    heading: "Rendered on your face",
    chip: "YouCam Makeup Virtual Try-On",
    lines: ["Tutorials are filmed on someone else's face. This one is rendered on yours.", "Mirror Tutor redraws the look for your lid, monolid or double."],
    actions: [
      { wait: "!!document.querySelector('[data-testid=hero-slider] [role=slider]')", timeout: 30000 },
      { sleep: 0.9 },
      { drag: { sel: "[data-testid=hero-slider] [role=slider]", parent: true, from: 0.5, to: 0.96, dur: 0.7 } },
      { sleep: 0.6 },
      { drag: { sel: "[data-testid=hero-slider] [role=slider]", parent: true, from: 0.96, to: 0.03, dur: 2.4 } },
      { sleep: 3.2 },
      { drag: { sel: "[data-testid=hero-slider] [role=slider]", parent: true, from: 0.03, to: 0.5, dur: 1.4 } },
      { sleep: 2.2 },
    ],
  },
  {
    // C13 live Face Analyzer call (--mode live --only livecall, 10 units): the licensed monolid stock photo (model-c, Unsplash License) is uploaded,
    // the real analysis runs (bottom bar "Remaining N" before, N-10 after) and the result is shown. Records only; recomposite picks the window.
    id: "livecall",
    sampleOnly: true,
    kicker: "Live call",
    heading: "One live YouCam call",
    chip: "YouCam AI Face Analyzer · 10 units",
    lines: ["One call to YouCam's Face Analyzer reads five features."],
    prep: [
      { wait: "document.querySelector('main h2')", timeout: 30000 },
      { tap: { sel: "button", text: "^Use my own selfie$" }, quiet: true },
      { sleep: 1.0 },
      { tap: { sel: "dialog[open] button", text: "Agree and start" }, quiet: true },
      { wait: "location.pathname === '/capture'" },
      { sleep: 1.0 },
      { tap: { sel: "button", text: "Upload photo" }, noClick: true, quiet: true },
    ],
    actions: [
      { sleep: 0.8 },
      { upload: "public/demo/model-c/original.jpg" },
      { wait: bodyHas("Analysis done"), fail: bodyHas("Analysis failed"), timeout: 90000 },
      { sleep: 3.0 },
      { js: "window.scrollTo(0, 0)" },
      { sleep: 2.0 },
    ],
  },
  {
    id: "compare",
    kicker: "Two faces, one lesson",
    heading: "Same look, different technique",
    chip: "Pre-generated with the live API · 0 units now",
    note: "Both faces are Pexels and Unsplash License stock photos",
    lines: [
      "Here's the proof. Same lesson, two different faces.",
      "Face Analyzer read the monolid as a double lid, so we corrected it, just as a user would. Then the rule table picked each face's technique.",
      "A monolid gets a horizontal gradient and a visible liner. A double lid gets crease shading. Same look, different technique.",
    ],
    prep: [{ route: "/compare" }, { wait: "location.pathname === '/compare' && document.querySelectorAll('figure img').length >= 2" }, { sleep: 1.2 }],
    actions: [
      // the page opens on the eye step (step 3), where the two techniques split
      { sleep: 1.0 },
      { tap: { sel: "button", text: "Show original" } },
      { sleep: 1.2 },
      { tap: { sel: "button", text: "Show answer" } },
      { at: 1 }, // the correction chip is on screen here
      { at: 2 },
      { scroll: { y: 330 }, dur: 1.3 },
      { sleep: 2.0 },
      // C7: the same look with a vertical gradient on the monolid face, next to the horizontal one (below the rule table)
      { scroll: { sel: "h2", text: "^Same look with a vertical", offset: 690 }, dur: 1.2 },
      { sleep: 3.0 },
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
    // C3: with --sample the attempt is the sample model's stock try ("Grade a sample try"), so the dark "camera unavailable"
    // capture screen of the headless live take is skipped
    sample: {
      prep: [],
      actions: [
        { sleep: 0.8 },
        { tap: { sel: "button", text: "^Grade a sample try" } },
        { wait: "location.pathname === '/grade'", timeout: 20000 },
        { wait: bodyHas("Graded") + " || " + bodyHas("Angle is quite different"), fail: bodyHas("Analysis failed"), timeout: 60000 },
        { scrollPast: "header ~ p[role=status]" },
        { sleep: 2.5 },
        { scroll: { y: 360 }, dur: 1.6 },
        { sleep: 3.0 },
      ],
    },
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
    // C3: the retailer view (/partner, concept screen). C12: the widget is a live iframe on the real /embed/lesson route (0 units, no API call).
    id: "partner",
    kicker: "For retailers",
    heading: "The lesson as an iframe widget",
    chip: "Concept screen · fictional store",
    lines: [
      "For retailers, the lesson is a live widget on the product page, matched to that SKU's shade.",
      "Integration is one plain iframe. No SDK, and no partner has used it yet.",
      "First lesson, fourteen units. Then four.",
    ],
    // C5: the entry path from home ("Retailer view (concept)" beside the sample button), then the widget
    prep: [{ route: "/" }, { wait: "location.pathname === '/' && document.body.innerText.includes('Retailer view')" }, { sleep: 1.0 }],
    actions: [
      { sleep: 1.6 },
      { tap: { sel: "a", text: "Retailer view" } },
      { wait: "!!document.querySelector('[data-testid=partner-widget] iframe')" },
      { wait: "!!document.querySelector('[data-testid=partner-widget] iframe')?.contentDocument?.querySelector('[data-testid=embed-match]')", timeout: 30000 },
      { js: "(() => { const css = 'nextjs-portal{display:none!important}'; for (const d of [document, document.querySelector('[data-testid=partner-widget] iframe')?.contentDocument]) { if (!d) continue; const st = d.createElement('style'); st.textContent = css; d.head.appendChild(st); } })()" }, // hide the dev-only indicator (absent in production)
      { scroll: { sel: "[data-testid=partner-widget] p", offset: 150 }, dur: 0.8 },
      { sleep: 0.3 },
      { drag: { sel: "[data-testid=partner-widget] iframe", from: 0.5, to: 0.1, dur: 0.7 } },
      { drag: { sel: "[data-testid=partner-widget] iframe", from: 0.1, to: 0.9, dur: 0.9 } },
      { drag: { sel: "[data-testid=partner-widget] iframe", from: 0.9, to: 0.5, dur: 0.5 } },
      { sleep: 0.3 },
      { scroll: { sel: "h2", text: "Integration is one iframe", offset: 200 }, dur: 1.4 },
      { sleep: 3.0 },
      { scroll: { sel: "h2", text: "YouCam units per session", offset: 240 }, dur: 1.2 },
      { sleep: 2.6 },
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
    actions: [{ scrollPast: "header ~ p[role=status]" }, { sleep: 1.0 }, { scroll: { y: 330 }, dur: 1.4 }, { at: 1 }, { sleep: 1.5 }, { scroll: { y: 0 }, dur: 1.0 }],
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
    // C5: in sample mode the page ends with the "Next: retailer view" card, so scroll down to it for the last line
    actions: [{ scrollPast: "header ~ p[role=status]" }, { sleep: 1.5 }, { at: 1, plus: 0.5 }, { scroll: { y: 300 }, dur: 1.4 }, { sleep: 1.0 }, { at: 2 }, { scroll: { sel: "[data-testid=retailer-end-card]", offset: 130 }, dur: 1.2 }, { sleep: 1.5 }],
  },
];

/**
 * `record-video.mjs --mode mock --sample --only shop`: reach the graded state through "Try with a sample model"
 * (the sample model's pre-generated live results, 0 units) instead of the live capture/analyze/lesson/grade shots.
 * Ends where the live "grade" shot ends (daily-k, step 4, graded, scrolled to the shop button).
 */
/** C11: the home picker defaults to the monolid sample, so the trial opens on /analyze with the analyzer's (wrong) Double-lid reading. */
export const SAMPLE_SETUP_ANALYZE = [
  { wait: "document.querySelector('main h2')", timeout: 30000 },
  { tap: { sel: "button", text: "^Try with a sample model" }, quiet: true },
  { wait: "location.pathname === '/analyze'", timeout: 20000 },
  { wait: bodyHas("Analysis done"), fail: bodyHas("Analysis failed"), timeout: 60000 },
  { sleep: 0.6 },
];
/** C11: the visitor's correction on /analyze (Fix the eyelid → Monolid), ending on the "Corrected to Monolid" state. */
export const SAMPLE_FIX = [
  { tap: { sel: "button", text: "^Fix the eyelid" }, quiet: true },
  { sleep: 0.8 },
  { tap: { sel: "label", text: "Monolid" }, quiet: true },
  { wait: bodyHas("Corrected to Monolid"), timeout: 10000 },
  { sleep: 0.6 },
];
export const SAMPLE_SETUP_FIXED = [...SAMPLE_SETUP_ANALYZE, ...SAMPLE_FIX];
export const SAMPLE_SETUP_LESSON = [
  ...SAMPLE_SETUP_FIXED,
  { tap: { sel: "button", text: "Start this lesson" }, quiet: true },
  { wait: "location.pathname === '/lesson'" },
  { wait: "document.querySelectorAll('nav[aria-label] button').length >= 4 && !!document.querySelector('img[alt^=\"Answer\"]') && !document.body.innerText.includes('Rendering')", fail: bodyHas("This step failed"), timeout: 60000 },
  { tap: { sel: "nav[aria-label] button:nth-child(4)" }, quiet: true },
  { sleep: 1.0 },
];
const SAMPLE_SETUP_GRADE = [
  { tap: { sel: "button", text: "^Grade a sample try" }, quiet: true },
  { wait: "location.pathname === '/grade'", timeout: 20000 },
  { wait: bodyHas("Graded") + " || " + bodyHas("Angle is quite different"), fail: bodyHas("Analysis failed"), timeout: 60000 },
  { sleep: 1.0 },
  { scroll: { y: 360 }, dur: 1.2 },
  { sleep: 0.8 },
];

export const SAMPLE_SETUP = [...SAMPLE_SETUP_LESSON, ...SAMPLE_SETUP_GRADE];

/** `record-video.mjs --mode mock --setup full --only home`: the upload flow in mock mode (0 units), ending on a graded try. */
export const FULL_SETUP = [
  { wait: "document.querySelector('main h2')", timeout: 30000 },
  { tap: { sel: "button", text: "^Use my own selfie$" }, quiet: true },
  { sleep: 1.0 },
  { tap: { sel: "dialog[open] button", text: "Agree and start" }, quiet: true },
  { wait: "location.pathname === '/capture'" },
  { sleep: 1.0 },
  { tap: { sel: "button", text: "Upload photo" }, noClick: true, quiet: true },
  { upload: PHOTO },
  { wait: "location.pathname === '/analyze'", timeout: 20000 },
  { wait: bodyHas("Analysis done"), fail: bodyHas("Analysis failed"), timeout: 90000 },
  { tap: { sel: "button", text: "Start this lesson" }, quiet: true },
  { wait: "location.pathname === '/lesson'" },
  { wait: "document.querySelectorAll('nav[aria-label] button').length >= 4 && !!document.querySelector('img[alt^=\"Answer\"]') && !document.body.innerText.includes('Rendering')", fail: bodyHas("This step failed"), timeout: 120000 },
  { save: { name: "lesson", js: "new URLSearchParams(location.search).get('id') || 'daily-k'" } },
  { tap: { sel: "nav[aria-label] button:nth-child(4)" }, quiet: true },
  { sleep: 0.8 },
  { tap: { sel: "a", text: "Snap your attempt" }, quiet: true },
  { wait: "location.pathname === '/capture'" },
  { sleep: 1.0 },
  { tap: { sel: "button", text: "Upload photo" }, noClick: true, quiet: true },
  { upload: ATTEMPT },
  { wait: "location.pathname === '/grade'", timeout: 20000 },
  { wait: bodyHas("Graded") + " || " + bodyHas("Angle is quite different"), fail: bodyHas("Analysis failed"), timeout: 90000 },
  { sleep: 1.0 },
];
