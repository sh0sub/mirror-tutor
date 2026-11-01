# Devpost submission text (copy and paste)

Track: **eCommerce VTO**. (Face Attribute & Ratio Analysis is a supporting input, not a separate track.)

## Tagline (<= 200 characters)

Makeup tutorials fit someone else's face. Mirror Tutor reads your features with YouCam, renders every lesson step on your own photo, then grades your real attempt and shows the products.

(Character count: 186.)

## Inspiration

Shoppers buy a shade, try the look from a tutorial filmed on someone else's face, and it comes out wrong. A gradient eyeshadow that works on a double eyelid can look muddy on a monolid, so the shopper guesses what to change, gets no feedback, and the shade becomes a regret. We wanted a tutorial that starts from your face, checks your result, and turns each step's color into the exact product to buy.

Face Analyzer read our monolid stock model as double-lid on both eyes. The app lets you correct it (marked "Edited") and the whole lesson changes. **/compare** puts both faces side by side with the analyzer's raw reading and the corrected value, plus the same monolid eye drawn with a horizontal and a vertical gradient (both real YouCam renders).

**YouCam VTO output is the answer key we grade your real attempt against, per region with CIEDE2000.**

## What it does for shoppers and retailers

- **Shoppers:** fewer shade regrets. You see each step on your own face, your attempt is scored per region, and every step links to the product in that exact color.
- **Retailers and brands:** a lesson widget for the product page. The step colors are matched to catalog products with CIEDE2000, so the retailer's own SKUs close the loop from "how do I wear it" to checkout.
- **Perfect Corp:** a lesson uses one Makeup VTO call per step, so an engaged user generates 4 renders where a product view is 1 try-on. That is a secondary point; the main value is the shopper and retailer outcome.

We claim no pilot, no retailer test and no measured lift. No conversion, revenue or real-user result exists yet; the demo uses stock photos only and the numbers here are unit costs from our live tests.

## Try it in 30 seconds (0 units, no selfie)

No selfie needed - 30 s walk-through. Open https://mirror-tutor.vercel.app/?lang=en (English UI) and tap the filled button "Try with a sample model · 0 units" (KO: "샘플 모델로 체험하기 · 0 유닛"), then walk analysis, the 4-step lesson, grading and shop the step. Then open /compare and "Retailer view (concept)". To use your own photo instead, tap "Use my own selfie" (asks for consent).

## How it works

1. **Capture and analyze:** a quality gate checks the photo before any unit is spent; Face Attribute & Ratio Analysis reads eyelid, eye, lip, face and brow shape, and you can correct any value.
2. **Technique:** a visible rule table maps each feature to a technique and a plain reason. Monolid gets a horizontal gradient shadow plus a liner visible 1.5 mm, a double lid gets crease shading. The monolid reason is a rule of thumb from public tutorials, not a Perfect Corp result: on a monolid the horizontal gradient reads as cleaner depth and the vertical blend is hidden by the lid fold, but both render, so /compare shows them next to each other.
3. **Lesson:** 3 lessons x 4 steps. A step k is Makeup VTO with effects 1..k rendered cumulatively on one uploaded `file_id`, so each step is an answer image, with a before/after slider.
4. **Grade and shop:** your real attempt is compared with that VTO answer per region (eye line, eyelid, cheek, lip) with CIEDE2000, with a one-line correction, then step colors are matched to catalog products (<= 5) and a share card is drawn.
5. **Retailer view:** /partner is a static concept page (fictional store, illustrative snippet, KPIs marked "hypothesis, no data yet").

This is not a wrapper: Face Analyzer output feeds a rule table instead of being displayed, VTO output is the grading reference, and the foundation shade is measured on the device from your cheeks and passed into the VTO foundation effect.

Also: Korean and English UI, a per-session unit cap, and a demo mode that serves pre-generated results when the API balance is low.

## Who would pay (a hypothesis, not a measured result)

| | |
|---|---|
| Buyer | A beauty retailer or brand: the product page or shopping app, where "how do I wear this shade" is the missing step before checkout. |
| Integration | An embeddable "learn this look on your face" widget. Lessons are JSON and the shop-the-step list reads a product feed, so the retailer's SKUs replace our demo catalog. |
| Pricing | Per session, set to cover YouCam units plus margin. First lesson 14 units (10 analysis + 4 renders), each later lesson 4 units (face profile reused on the device); a per-session cap (20) and a daily cap bound the cost. |
| KPI | Shop-the-step conversion compared with a plain product page. |

Demand context, not proof for our app: PYMNTS (27 Feb 2024, citing National Retail Federation data) reports "the blended return rate for beauty retail purchases is 4.3%". Source: https://www.pymnts.com/news/ecommerce/2024/perfect-corp-ar-try-on-reduces-returns-for-ecommerce-beauty-brands/. We found no independent data on eyelid-specific tutorial demand and claim none.

## Accomplishments that we're proud of

- The loop is closed: analyze -> technique -> answer image -> your attempt -> score -> product.
- Techniques depend on the face and the rule table is visible, with its reason in plain words and labelled a rule of thumb.
- 206 tests (27 files) run offline against the real pattern catalog and recorded API bodies; typecheck and lint are clean.

## How we built it

Pipeline (`docs/pipeline.svg`): Face Analyzer (10 units, once) -> rule table (0) -> Makeup VTO effects 1..k cumulative (1 unit per step) -> CIEDE2000 grading on device (0) -> catalog match (0).

- **Next.js 15 + TypeScript** on Vercel. Images are processed in memory only; EXIF is stripped with `sharp`.
- **Face Attribute & Ratio Analysis** (`POST /s2s/v2.0/task/face-attr-analysis`): five features (`eyelid, eyeShape, lipShape, faceShape, eyebrowShape`, 10 units) with `face_angle_strictness_level: flexible`, because the default `high` rejected both stock test photos.
- **Makeup VTO** (`POST /s2s/v2.0/task/makeup-vto`): `skin_smooth`, `foundation`, `eyebrows`, `eye_shadow`, `eye_liner`, `blush`, `contour`, `lip_color`. Request builders are tested against recorded live bodies (`docs/api-notes.md`).
- **Unit guard:** units reserved before a task and released on error, session and daily caps, balance read from the credit endpoint, render cache keyed on image + effects.
- **Grading:** MediaPipe Face Landmarker runs in the browser and computes per-region CIELAB means; the server computes CIEDE2000 and Claude (claude-opus-5-5) writes the one-line corrections from those numbers (text only). A fixed-box fallback grader runs if MediaPipe cannot.
- **Skin shade:** measured in the browser from trimmed cheek and forehead pixels in CIELAB, nearest of six shades; the user can pick by hand.
- **Shop the step:** a demo catalog of 17 fictional "MT Select" SKUs matched by color difference and texture.
- **Privacy:** no image stored server-side, nothing logged, share card drawn on the device.

## Challenges we ran into

- The API docs and the live server disagreed in several places (face angle strictness, eyebrow pattern fields, ombre lip fields). We recorded the accepted bodies and tested our builders against them.
- Grading a hand-drawn face is sensitive to lighting and framing, so we compare per-region color on landmark polygons and report a confidence level.
- Face Analyzer read two clearly monolid stock faces as `Double-lid`, which is why users can correct any attribute; /compare shows the raw reading next to the corrected value.

## What's next

- Validate with monolid and hooded-lid users: does the per-region score rise across attempts?
- Replace the demo catalog with a partner product feed; let brands publish lessons as JSON.

## Honest notes

- The analysis and the four Makeup VTO renders of the first lesson are real YouCam API calls (14 units, captured live). The sample trial, the compare view and the grade scene in the video play back pre-generated results at 0 units (the grade scene scores a simulated attempt, see the next point); a banner says so on every screen.
- The sample grading screen scores a simulated attempt, labelled as such on screen: the lesson's answer image with each graded region deliberately shifted off-shade by a script (`scripts/demo/make-sample-attempt.ts`, 0 units). The scores (eyeliner 77, eyelid 85, cheeks 93, lips 62, total 79) are real CIEDE2000 differences between those two images, with the delta-E value and the answer/attempt color pair shown for each region, but the attempt is not a real selfie.
- Face Analyzer read our monolid stock model as double-lid; we corrected the eyelid in the app's edit sheet and the lesson changed.
- All faces are Pexels or Unsplash License stock photos, not real users.

## Built with

Next.js, React, TypeScript, Tailwind CSS, YouCam API (Face Attribute & Ratio Analysis, Makeup VTO), Anthropic Claude API, MediaPipe Face Landmarker, sharp, zod, Vitest, Vercel

## Try it out

- Live demo: https://mirror-tutor.vercel.app (if the YouCam balance is low it shows pre-generated sample models and says so)
- Retailer view (concept): https://mirror-tutor.vercel.app/partner
- Source code: https://github.com/sh0sub/mirror-tutor (public, MIT)
- Video: YouTube link (add after upload). About 2:55, faceless (stock photos only); what is live and what is pre-generated is listed under "Honest notes".
- Test images: `public/demo/model-a`, `model-b` (Pexels License), `model-c` (Unsplash License); `model-a/sample-attempt.jpg` is a simulated attempt derived from model-a's answer image
