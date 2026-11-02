# Devpost submission text (copy and paste)

Track: **eCommerce VTO**. (Face Attribute & Ratio Analysis is a supporting input, not a separate track.)

## Tagline (<= 200 characters)

Makeup tutorials fit someone else's face. Mirror Tutor reads your features with YouCam, renders every lesson step on your own photo, then grades your real attempt and shows the products.

(Character count: 186.)

## Try it (no selfie, 0 units)

- **30-second walk-through:** https://mirror-tutor.vercel.app/?lang=en - pick **Monolid** (the analyzer misreads it, you fix it) or **Double-lid**, tap the filled button "Try with a sample model · 0 units" (KO: "샘플 모델로 체험하기 · 0 유닛"), then walk analysis, a 4-step lesson, grading and shop the step. To use your own photo instead, tap "Use my own selfie" (asks for consent).
- **Retailer view (live widget in a fictional store):** https://mirror-tutor.vercel.app/partner?lang=en - the "In your store" strip, your own lip shade, the iframe snippet, a cost calculator and an illustrative break-even from your own inputs.
- **Two faces side by side:** https://mirror-tutor.vercel.app/compare?lang=en
- Deep links (`/shop`, `/grade`, `/share`) opened cold or reloaded offer the same one-tap sample trial, so no page is a dead end.

## Honest notes (read these first)

- **Analyzer misread, corrected by hand:** Face Analyzer read our monolid stock model as double-lid. The Monolid sample replays this: the analysis shows the real, wrong reading, the fix is the visitor's tap ("Fix the eyelid", marked "Edited"), and the corrected lesson is real pre-generated renders. Without the fix the same sample plays the lesson for the uncorrected reading, also real renders. /compare shows both.
- **No pilot:** no retailer, user test or measured lift exists. The idea that a shopper who has seen the look on their own face in the exact catalog shade returns fewer products is a hypothesis, untested. The monolid horizontal-gradient rule is a rule of thumb from public tutorials, not a Perfect Corp result.
- **Demo catalog:** 18 fictional "MT Select" SKUs, not a partner feed. The store on /partner is fictional; the `/embed/lesson` widget is real.
- **Live vs pre-generated:** the sample trial and /compare play back real YouCam calls captured live (14 units for the first lesson) at 0 units, and a banner says so on every screen. A selfie on the live site runs the live path.
- **Simulated attempt:** the sample grade scores a labelled, simulated attempt (the answer image with each region shifted off-shade by `scripts/demo/make-sample-attempt.ts`). Scores are real CIEDE2000 differences between those two images (total 79 for both samples), computed offline with the on-device landmark grader. Grading your own selfie runs live.
- **Faces:** all are Pexels or Unsplash License stock photos, not real users.

## How deeply we use YouCam

| YouCam API | What we do with it | Units |
|---|---|---|
| Face Attribute & Ratio Analysis | 5 features (eyelid, eye shape, lip, face, brow) drive a visible rule table, so a monolid and a double lid get different techniques. | 10, once |
| Makeup VTO | Lesson step k renders effects 1..k cumulatively on one `file_id`: 8 effects, with the on-device foundation shade passed in. The output is the answer key we grade your attempt against. | 1 per step |
| Credit / feature-cost | Unit guard: reserve before a task, session and daily caps, demo mode when the balance is low. | 0 |

**YouCam provides:** face reading and the makeup renders. **Ours:** the rule table that picks the technique, the correction flow for analyzer misreads, per-region CIEDE2000 grading of a real attempt on landmark polygons, catalog matching, and the embeddable widget.

**This is not a wrapper:** the analyzer's output feeds a visible rule table instead of being displayed, VTO output is the grading reference, and the foundation shade is measured on the device from your cheeks and passed into the VTO foundation effect.

## Inspiration

A gradient eyeshadow that works on a double eyelid can look muddy on a monolid, and a wrong eyelid reading from AI changes the technique the shopper is taught. We wanted a tutorial that starts from your face, lets you correct the reading in one tap, checks your result, and turns each step's color into the exact product to buy.

## Why a brand pays

Buyer: a beauty retailer or brand that sells try-on on its product pages. Try-on answers "how does this shade look on me", not "how do I wear it".

- **Drop-in today:** `/embed/lesson?sku=...` (or `?hex=...&name=...` for a shade outside our demo catalog), a chrome-less iframe: stepper, bare/finished slider, the shade matched to the lesson color with CIEDE2000. Flow in a store: product page widget, lesson, add the lesson's own products to the cart (the store handles checkout).
- **Unit cost is known:** 14 YouCam units for a first lesson (10 analysis + 4 renders), 4 for each later lesson, session cap 20. /partner turns your session counts into monthly units and, with your own unit price and margin per order, into the extra orders needed to break even. Example inputs only, no assumed traffic, conversion or price.
- **Pricing and KPI (hypothesis):** per session, set to cover YouCam units plus margin; measure shop-the-step conversion against a plain product page.
- **Demand context, not proof for our app:** PYMNTS (27 Feb 2024, citing National Retail Federation data) reports "the blended return rate for beauty retail purchases is 4.3%". Source: https://www.pymnts.com/news/ecommerce/2024/perfect-corp-ar-try-on-reduces-returns-for-ecommerce-beauty-brands/. We found no independent data on eyelid-specific tutorial demand and claim none.

## How it works

1. **Capture and analyze:** a quality gate checks the photo before any unit is spent; Face Attribute & Ratio Analysis reads eyelid, eye, lip, face and brow shape, and you can correct any value.
2. **Technique:** a visible rule table maps each feature to a technique and a plain reason. Monolid gets a horizontal gradient shadow plus a liner visible 1.5 mm, a double lid gets crease shading.
3. **Lesson:** 3 lessons x 4 steps. A step k is Makeup VTO with effects 1..k rendered cumulatively on one uploaded `file_id`, so each step is an answer image, with a before/after slider.
4. **Grade and shop:** your real attempt is compared with that VTO answer per region (eye line, eyelid, cheek, lip) with CIEDE2000, with a one-line correction, then step colors are matched to catalog products (<= 5) and a share card is drawn on the device.

Also: Korean and English UI, per-session and daily unit caps, a render cache, and a demo mode that serves pre-generated results when the API balance is low.

## Accomplishments that we're proud of

- A misread caught and fixed in one tap, and the whole lesson changes; a real attempt graded per region with CIEDE2000 against the VTO answer; an embeddable widget at 0 units.
- 233 tests (30 files) run offline against recorded API bodies; typecheck and lint are clean.

## How we built it

Pipeline (`docs/pipeline.svg`): Face Analyzer (10 units, once) -> rule table (0) -> Makeup VTO effects 1..k cumulative (1 unit per step) -> CIEDE2000 grading on device (0) -> catalog match (0).

- **Next.js 15 + TypeScript** on Vercel. Images are processed in memory only; EXIF is stripped with `sharp`.
- **Face Attribute & Ratio Analysis** (`POST /s2s/v2.0/task/face-attr-analysis`): five features, 10 units, with `face_angle_strictness_level: flexible`, because the default `high` rejected both stock test photos.
- **Makeup VTO** (`POST /s2s/v2.0/task/makeup-vto`): `skin_smooth`, `foundation`, `eyebrows`, `eye_shadow`, `eye_liner`, `blush`, `contour`, `lip_color`. Request builders are tested against recorded live bodies (`docs/api-notes.md`).
- **Grading:** MediaPipe Face Landmarker runs in the browser and computes per-region CIELAB means; the server computes CIEDE2000 and Claude (claude-opus-5-5) writes the one-line corrections from those numbers (text only). A fixed-box fallback grader runs if MediaPipe cannot.
- **Privacy:** no image stored server-side, nothing logged, share card drawn on the device. A reload keeps a sample trial in the tab's sessionStorage (sample id and the 5 attributes only).

## What's next

- Validate with monolid and hooded-lid users: does the per-region score rise across attempts?
- Replace the demo catalog with a partner product feed; let brands publish lessons as JSON.

## Built with

Next.js, React, TypeScript, Tailwind CSS, YouCam API (Face Attribute & Ratio Analysis, Makeup VTO), Anthropic Claude API, MediaPipe Face Landmarker, sharp, zod, Vitest, Vercel

## Try it out

- Live demo: https://mirror-tutor.vercel.app/?lang=en (if the YouCam balance is low it shows pre-generated sample models and says so)
- Retailer view: https://mirror-tutor.vercel.app/partner?lang=en ; widget: https://mirror-tutor.vercel.app/embed/lesson?sku=MT-VT-07&lang=en
- Source code: https://github.com/sh0sub/mirror-tutor (public, MIT)
- Video: YouTube link (add after upload). About 2:55 (175.3 s), faceless (stock photos only); the real tap on "Try with a sample model" lands at about 0:14 and the first analysis screen follows, with zoom panels on the raw Double-lid reading and the Edited chip; a later scene shows a live Face Analyzer call on a stock monolid face (unit counter 883 -> 873, 10 units; it read Double-lid again).
- Test images: `public/demo/model-a`, `model-b` (Pexels License), `model-c` (Unsplash License); `model-a/sample-attempt.jpg` is a simulated attempt derived from model-a's answer image
