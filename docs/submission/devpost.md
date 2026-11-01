# Devpost submission text (copy and paste)

Track: **eCommerce VTO**. (Face Attribute & Ratio Analysis is used as a supporting input, not as a separate track.)

## Tagline (<= 200 characters)

Makeup tutorials fit someone else's face. Mirror Tutor reads your features with YouCam, renders every lesson step on your own photo, then grades your real attempt and shows the products.

(Character count: 186.)

**Why it matters to Perfect Corp.** Each lesson is 4 Makeup VTO calls per engaged user (one per step), where a normal product view is one try-on; a retailer widget turns a single look into a repeat-use session that ends on a product.

**The hook.** Face Analyzer read our monolid stock model as double-lid on both eyes. The app lets you correct it (marked "Edited"), and the whole lesson changes. The compare page shows both faces side by side, with the analyzer's raw reading and the corrected value.

**Try it in 30 seconds (0 units, no selfie).**
1. Open https://mirror-tutor.vercel.app and tap "Try with a sample model · 0 units" (KO: "샘플 모델로 체험하기 · 0 유닛").
2. Walk analysis, the 4-step lesson, grading and shop the step; every image is a real pre-generated YouCam result.
3. Open /compare for the monolid vs double-lid split (the technique rows are plain words, not API tokens), and "Retailer view (concept)" for the retailer view (widget, unit cost, KPIs to measure).

**Why this is not a wrapper.**
- Face Analyzer output is not displayed, it feeds a rule table: monolid gets a horizontal gradient and a liner visible 1.5 mm, a double lid gets a different technique.
- A lesson step k is YouCam Makeup VTO with effects 1..k rendered cumulatively on one uploaded `file_id`, so each step is an answer image.
- That VTO output is the grading reference: your real attempt is compared to it per region with CIEDE2000.
- The foundation shade is measured on the device from your cheeks and passed into the VTO foundation effect.

## What it does

1. **Capture and analyze:** a quality gate checks the photo before any unit is spent; Face Attribute & Ratio Analysis reads eyelid, eye, lip, face and brow shape, and you can correct any value (marked "Edited").
2. **Technique:** a visible rule table maps each feature to a technique and a plain reason (monolid -> horizontal gradient shadow + liner visible 1.5 mm).
3. **Lesson:** 3 lessons x 4 steps; Makeup VTO renders each step cumulatively on your photo, with a before/after slider.
4. **Grade and shop:** per-region scores (eye line, eyelid, cheek, lip) with a one-line correction, then step colors matched to catalog products by CIEDE2000 (<= 5) and a share card.
5. **Compare and /partner:** a monolid and a double-lid face get the same look with different eye techniques (/compare, pre-generated, 0 units); /partner shows the retailer view.

Also: Korean and English UI, a per-session unit cap, a demo mode that serves pre-generated results when the API balance is low, and a practice streak stored on the device only.

## Who would pay (a hypothesis, not a measured result)

| | |
|---|---|
| Buyer | A beauty retailer or brand: the product page or the shopping app, where "how do I wear this shade" is the missing step before checkout. |
| Integration | An embeddable "learn this look on your face" widget. Lessons are JSON (steps, colors, techniques) and the shop-the-step list reads a product feed, so the retailer's own SKUs replace our demo catalog. |
| Pricing | Per session, set to cover YouCam units plus margin. A first lesson costs 14 units (10 analysis + 4 renders), each later lesson 4 units because the face profile is reused on the device; the server enforces a per-session cap (20) and a daily cap, so cost per user is bounded. |
| KPI | Shop-the-step conversion: sessions that end on a product the lesson used, compared with a plain product page. |
| What it adds for Perfect Corp | Repeat VTO usage: 4 renders per lesson and per returning user instead of one try-on per product view. |

Measured unit cost (live runs): 14 units for a first lesson (10 analysis + 4 renders), 4 units for each later lesson, 0 for the sample and compare views. A retailer would pay that unit cost plus margin per engaged session.

Demand context, not proof for our app: PYMNTS (27 Feb 2024, citing National Retail Federation data) reports "the blended return rate for beauty retail purchases is 4.3%", and that returns cost US retailers $743 billion in merchandise in 2023 (all retail, not beauty only). Source: https://www.pymnts.com/news/ecommerce/2024/perfect-corp-ar-try-on-reduces-returns-for-ecommerce-beauty-brands/. We found no independent data on eyelid-specific tutorial demand and do not claim any.

The /partner page shows this as a screen (reachable from the home screen and from the end of the sample trial): the lesson widget on a fictional product page, an illustrative one-line integration shape (no SDK is published), a unit-cost meter (14, then 4) and the KPIs marked "hypothesis, no data yet". The lesson JSON and the `lib/catalog` product-feed schema (sku, category, localized name, shade hex list, texture, price) are the integration surface.

**Caveat, stated once:** no pilot has been run and there is no conversion, revenue or real-user result; the demo uses stock photos only, and the numbers above are unit costs from our live tests.

## Accomplishments that we're proud of

- The loop is closed: analyze -> technique -> answer image -> your attempt -> score -> product. The VTO output is the grading reference, not just a picture.
- Techniques depend on the face. The rule table is visible in the app, so it is clear that the output changes with the eyelid. The monolid rule also shows its reason in plain words (no visible crease, so a vertical gradient disappears and a horizontal one stays) and is labelled a rule of thumb from public tutorials, not a Perfect Corp result.
- Per-step answer images cost one unit each, and a first-time flow costs 14 units.
- 203 tests (27 files) run offline against the real pattern catalog and recorded API bodies; typecheck and lint are clean.

## How we built it

Pipeline (diagram: `docs/pipeline.svg`): Face Analyzer (10 units, once) -> rule table (0) -> Makeup VTO effects 1..k cumulative (1 unit per step) -> CIEDE2000 grading on device (0) -> catalog match (0).

- **Next.js 15 + TypeScript** on Vercel. Images are processed in memory only; EXIF is stripped with `sharp`.
- **YouCam Face Attribute & Ratio Analysis** (`POST /s2s/v2.0/task/face-attr-analysis`, 10 units for 1-5 features): we request `eyelid, eyeShape, lipShape, faceShape, eyebrowShape` with `face_angle_strictness_level: flexible` (the default `high` rejected both stock test photos in our live tests). The response is normalized into a profile; Deep-Set maps to hooded, and mixed single/double eyelids map to inner-double.
- **YouCam Makeup VTO** (`POST /s2s/v2.0/task/makeup-vto`, 1 unit per image): a lesson step k sends effects 1..k in one call on the same uploaded `file_id`, so each step is a cumulative answer image. Effects used: `skin_smooth`, `foundation`, `eyebrows`, `eye_shadow`, `eye_liner`, `blush`, `contour`, `lip_color`. Pattern labels come from the public pattern catalog and are checked against it in tests. Live calls corrected several details versus the docs (for example, eyebrow shape patterns require curvature, thickness and definition; ombre lips need two palettes and different field names). Request builders are tested against recorded live response bodies. All of it is in `docs/api-notes.md`.
- **Unit guard**: units are reserved before a task and released on error; session cap 20, a daily cap, balance read from the credit endpoint, and a render cache keyed on image + effects.
- **Grading**: MediaPipe Face Landmarker runs in the browser and computes per-region CIELAB means, so the same face area is compared even when framing differs. The server computes CIEDE2000 against the answer and Claude (claude-opus-5-5) writes the one-line corrections from those numbers (text only). If MediaPipe cannot run, a fixed-box fallback grader is used.
- **Skin shade**: the browser trims the brightest and darkest 20% of cheek and forehead pixels, averages them in CIELAB and picks the nearest of six shades by CIEDE2000. Confidence drops when the two cheeks disagree or the photo is too dark or bright, and the user can pick the shade by hand.
- **Shop the step**: a demo catalog of 17 fictional "MT Select" SKUs, matched by color difference and texture.
- **Privacy**: no image stored server-side, nothing logged, localStorage keeps only five attributes, share card drawn on the device.

## Inspiration

Makeup tutorials are filmed on someone else's face. A gradient eyeshadow that works on a double eyelid looks muddy on a monolid, and a viewer with monolids has to guess what to change. After trying, there is no feedback on how close the result is, and finding the same shades is a separate search. We wanted a tutorial that starts from your face, checks your result, and turns the colors in each step into a shopping list.

## What we learned

- Cumulative rendering (effects 1..k on one `file_id`) makes a step-by-step tutorial cheap and consistent.
- Do not trust a doc example before checking the server: the error messages of the live API were the most reliable spec.
- Honest limits (confidence, "demo data") build more trust than a single big score.

## What's next

- Business case: see "Who would pay" above (buyer, integration, pricing, KPI) and the /partner page.
- **Validation plan:** run the flow with monolid and hooded-lid users and measure whether the per-region score rises across attempts.
- Replace the demo catalog with a partner product feed (for example a retailer feed or a shopping search API) so each step links to real SKUs and shades.
- Extend skin-tone personalization from foundation and blush to lip and shadow palettes.
- Let brands and creators publish their own lessons as JSON.
- More lessons and a practice history with score trends.

## Challenges we ran into

- The API docs and the live server disagreed in several places (face angle strictness, eyebrow pattern fields, ombre lip fields, palette counts). We wrote probes, recorded the real accepted bodies and made the tests compare our builders with them.
- Face Analyzer is priced by feature-count tier; we keep it at five features (10 units) and reuse the profile on-device so returning users only pay for VTO steps.
- Grading a hand-drawn face is sensitive to lighting and framing. We compare per-region color on landmark polygons, report a confidence level and say so instead of hiding the error.
- Face Analyzer read two clearly monolid stock faces as `Double-lid` on both eyes. This is why the results screen lets users correct any attribute (marked "Edited"). The monolid face on the compare page went through that same correction: the page shows the analyzer's raw reading next to the corrected value, and the rule table and VTO ran on the corrected profile.
- Staying inside a small unit budget while still demoing live: reservation-based guard, cache, pre-generated compare faces and a demo mode.

## Built with

Next.js, React, TypeScript, Tailwind CSS, YouCam API (Face Attribute & Ratio Analysis, Makeup VTO), Anthropic Claude API, MediaPipe Face Landmarker, sharp, zod, Vitest, Vercel

## Try it out

- Live demo: https://mirror-tutor.vercel.app (if the YouCam balance is low it shows pre-generated sample models and says so)
- **For judges (no selfie needed, 0 units):** on the home screen or the camera/consent step, tap **"Try with a sample model · 0 units"** (KO: "샘플 모델로 체험하기 · 0 유닛"). It runs the whole flow on a stock-photo model: analysis → 4-step lesson with the real pre-generated YouCam Makeup VTO results → grading of a stock "attempt" → shop the step → share card. A banner says it is a sample, nothing is uploaded, and the server path for it has no YouCam client, so it cannot spend units. To try it on your own face, tap "Get started" instead.
- Retailer view (concept): https://mirror-tutor.vercel.app/partner (fictional store, illustrative snippet, KPIs marked hypothesis)
- Source code: https://github.com/sh0sub/mirror-tutor (public, MIT)
- Video: YouTube link (add after upload). The demo (about 2:54, 173.8 s) is faceless (stock photos only). What is live and what is not: the analysis and the four Makeup VTO renders are real YouCam API calls (14 units, captured live). The home intro, the compare segment and the grade scene run in sample/mock mode with 0 units; the grade scene scores a stock "attempt" (score 91; the earlier live capture scored 87). The camera segment uses a stock photo fed through a fake camera to show the quality gate (no shutter, no API call), and /partner is a static concept page.
- Test images: `public/demo/model-a`, `model-b` (Pexels License) and `model-c` (monolid face, Unsplash License) in the repository; all sample faces are Pexels and Unsplash License stock photos (commercial use allowed, not real users). Or use your own selfie
- API notes: `docs/api-notes.md` in the repository
