# Devpost submission text (copy and paste)

Track: **eCommerce VTO**. (Face Attribute & Ratio Analysis is used as a supporting input, not as a separate track.)

## Tagline (<= 200 characters)

Makeup tutorials fit someone else's face. Mirror Tutor reads your features with YouCam, renders every lesson step on your own photo, then grades your real attempt and shows the products.

(Character count: 186.)

## Inspiration

Makeup tutorials are filmed on someone else's face. A gradient eyeshadow that works on a double eyelid looks muddy on a monolid, and a viewer with monolids has to guess what to change. After trying, there is no feedback on how close the result is, and finding the same shades is a separate search. We wanted a tutorial that starts from your face, checks your result, and turns the colors in each step into a shopping list.

## What it does

1. Capture: a live quality gate (face width at least 60% of the frame, light, frontal, zoom) checks the photo against YouCam's input requirements before any API unit is spent.
2. Analyze: YouCam Face Attribute & Ratio Analysis reads eyelid, eye shape, lip shape, face shape and brow shape. The user can correct any value, with no re-analysis. The base shade is measured on the device from the cheeks and forehead and mapped to one of six foundation shades (13N to 27W); only the shade id leaves the browser.
3. Technique selection: a hand-written rule table maps each feature to a technique and a plain-language reason. Example: monolid -> horizontal gradient shadow + liner visible 1.5 mm.
4. Lesson: three lessons (Daily K-look, Soft shading, Gradient lips) of four steps each. YouCam Makeup VTO renders each step cumulatively on the user's own photo as the answer key, with the foundation color set to the measured shade, with a before/after slider and "why this fits you" reasons.
5. Grade: the user does the makeup and photographs the result. Per-region scores (eye line, eyelid, cheek, lip) come from color differences, with a one-line correction and a confidence level.
6. Shop the step: the exact hex colors of a step are matched to catalog products by CIEDE2000 (<= 5). Then a share card.
7. Compare: a page with two pre-generated demo faces (double vs inner-double eyelid) showing the same look with different techniques.

Also: Korean and English UI, a per-session unit cap, and a demo mode that serves pre-generated results when the API balance is low.

## How we built it

- **Next.js 15 + TypeScript** on Vercel. Images are processed in memory only; EXIF is stripped with `sharp`.
- **YouCam Face Attribute & Ratio Analysis** (`POST /s2s/v2.0/task/face-attr-analysis`, 10 units for 1-5 features): we request `eyelid, eyeShape, lipShape, faceShape, eyebrowShape` with `face_angle_strictness_level: flexible` (the default `high` rejected both stock test photos in our live tests). The response is normalized into a profile; Deep-Set maps to hooded, and mixed single/double eyelids map to inner-double.
- **YouCam Makeup VTO** (`POST /s2s/v2.0/task/makeup-vto`, 1 unit per image): a lesson step k sends effects 1..k in one call on the same uploaded `file_id`, so each step is a cumulative answer image. Effects used: `skin_smooth`, `foundation`, `eyebrows`, `eye_shadow`, `eye_liner`, `blush`, `contour`, `lip_color`. Pattern labels come from the public pattern catalog and are checked against it in tests. Live calls corrected several details versus the docs (for example, eyebrow shape patterns require curvature, thickness and definition; ombre lips need two palettes and different field names). Request builders are tested against recorded live response bodies. All of it is in `docs/api-notes.md`.
- **Unit guard**: units are reserved before a task and released on error; session cap 20, a daily cap, balance read from the credit endpoint, and a render cache keyed on image + effects.
- **Grading**: MediaPipe Face Landmarker runs in the browser and computes per-region CIELAB means, so the same face area is compared even when framing differs. The server computes CIEDE2000 against the answer and Claude (claude-opus-5-5) writes the one-line corrections from those numbers (text only). If MediaPipe cannot run, a fixed-box fallback grader is used.
- **Skin shade**: the browser trims the brightest and darkest 20% of cheek and forehead pixels, averages them in CIELAB and picks the nearest of six shades by CIEDE2000. Confidence drops when the two cheeks disagree or the photo is too dark or bright, and the user can pick the shade by hand.
- **Shop the step**: a demo catalog of 17 fictional "MT Select" SKUs, matched by color difference and texture.
- **Privacy**: no image stored server-side, nothing logged, localStorage keeps only five attributes, share card drawn on the device.

## Challenges we ran into

- The API docs and the live server disagreed in several places (face angle strictness, eyebrow pattern fields, ombre lip fields, palette counts). We wrote probes, recorded the real accepted bodies and made the tests compare our builders with them.
- Face Analyzer is priced by feature-count tier; we keep it at five features (10 units) and reuse the profile on-device so returning users only pay for VTO steps.
- Grading a hand-drawn face is sensitive to lighting and framing. We compare per-region color on landmark polygons, report a confidence level and say so instead of hiding the error.
- Staying inside a small unit budget while still demoing live: reservation-based guard, cache, pre-generated compare faces and a demo mode.

## Accomplishments that we're proud of

- The loop is closed: analyze -> technique -> answer image -> your attempt -> score -> product. The VTO output is the grading reference, not just a picture.
- Techniques depend on the face. The rule table is visible in the app, so it is clear that the output changes with the eyelid.
- Per-step answer images cost one unit each, and a first-time flow costs 14 units.
- Tests run offline against the real pattern catalog and recorded API bodies.

## What we learned

- Cumulative rendering (effects 1..k on one `file_id`) makes a step-by-step tutorial cheap and consistent.
- Do not trust a doc example before checking the server: the error messages of the live API were the most reliable spec.
- Honest limits (confidence, "demo data") build more trust than a single big score.

## What's next

- Replace the demo catalog with a partner product feed so each step links to real SKUs and shades.
- Extend skin-tone personalization from foundation and blush to lip and shadow palettes.
- Let brands and creators publish their own lessons as JSON.
- More lessons and a practice history with score trends.

## Built with

Next.js, React, TypeScript, Tailwind CSS, YouCam API (Face Attribute & Ratio Analysis, Makeup VTO), Anthropic Claude API, MediaPipe Face Landmarker, sharp, zod, Vitest, Vercel

## Try it out

- Live demo: https://mirror-tutor.vercel.app (if the YouCam balance is low it shows pre-generated sample models and says so)
- Source code: https://github.com/sh0sub/mirror-tutor (public, MIT)
- Video: YouTube link (add after upload)
- Test images: `public/demo/model-a` and `model-b` in the repository (stock photos, Pexels License), or use your own selfie
- API notes: `docs/api-notes.md` in the repository
