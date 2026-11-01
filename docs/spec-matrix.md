# Spec matrix (planning artifact `youcam*` vs running product)

Round 1, 2 and 3 audit, 2026-11-01, mock mode, 390px and 1440px. Round 2: tests 178/178, typecheck and lint clean.
Screenshots: scratchpad `converge/mirror-tutor/shots/` (r1) and `shots-r2/` (r2).

| id | artifact section | expected | status | evidence |
|---|---|---|---|---|
| F1 | 05 / s1 M1 | Capture guide: oval, 60% target, width meter, error mapping (small/dark/no face), shutter gated | match | m-q-small (28% / need 60%), m-q-dark, m-q-noface |
| F1b | s1 M1 | Consent sheet first time only, YouCam 30-day retention text | match | Consent saved in localStorage (lib/practice.ts); no sheet after reload (fix-r1/r1-capture-reload), tests/unit/practice.test.ts |
| F2 | s1 M2 | Analyzing: thumbnail, 3 steps, 5 skeleton cards, units + remaining, disabled CTA | match | m-analyzing2 |
| F2b | s2 M2 | Result: photo pins, 5 attribute cards, edit sheet (4 options), "직접 수정" badge, 0u, recommended lesson | match | m-analyze-result, m-after-edit |
| F3 | 05 F3 | Rule table viewable and branching | match | m-rules |
| F4/F5 | s2 M3 | Stepper dots, before/after slider, dashed region oval, why card, hex chips, partial-render state, next / "내 시도 찍기" | match | m-lesson-loading, m-lesson-3 |
| S4 | 05 S4 | Intensity -20/+20 re-render (1u) | match | lesson text "진하기" |
| F6 | s3 M4 | Region scores on attempt, ring /100, confidence, check/warn rows, one-line fix | match | m-grade |
| F7 | s3 M6 | Shop the step as 70% bottom sheet over answer image, swatch highlights region, ΔE chips, KRW + USD, cart badge, external-leave confirm | match | Sheet (radius 22, handle) over answer image, region highlight follows swatch, KRW and USD, Korean title (fix-r1/r1-shop, r2-shop-lip-swatch). 2026-11-02: each product shows an original brand-neutral inline-SVG illustration tinted with its shade(s) (cushion, brow pencil, shadow duo, gel liner, tint, blush) in the list and the "스토어에서 보기" sheet; hex/ΔE kept (components/ProductArt.tsx, sample.test.ts) |
| S3 | s4 M7 | Share card 3-split + score, blur 8px, hide score, progress card, save toast, native share | match | m-share (save toast not observed in headless) |
| HOME | s4 Home | Returning home: profile summary, today lesson, streak dots, past-result thumbnails, 5-tab bottom bar, app bar with bell/avatar | match | Streak dots + "N일 연속", past-result tiles (score, session attempt photo when in memory, dashed 도전 전), 5-tab bar, bell/avatar (fix-r1/r2-home-full). Photos are never persisted, so after reload tiles show score only |
| M5 | s4 M5 | 3-way compare original / answer / attempt | match | /record: segmented original/answer/attempt, swipe, long-press peek, locked attempt tab, reachable from home tiles and tab bar (fix-r1/r2-record-*) |
| WIN-fold | lesson desktop | Judge sees why card and hex chips at once | match | 1440px two-column lesson (fix-r1/r3-desktop-lesson) |
| NIT-label | s2 M2 | Attribute caption without duplicate | match | "(Single-lid)" via sourceCaption on analyze and compare |
| S2 | 05 S2 / demo | Same look on monolid vs double-lid models | match | /compare shows a real monolid face (model-c, Unsplash License, public/demo/model-c/SOURCE.md) next to the double-lid face (model-a), labeled "홑꺼풀 얼굴 / 쌍꺼풀 얼굴" (Monolid face / Double-lid face) instead of generic model labels, and opens on the eye step where the rule-table techniques differ. Face Analyzer read model-c as Double-lid, so its eyelid was corrected as on M2 (`edited`; a chip next to the face label reads "Analyzer read Double-lid → corrected to Monolid", and the raw reading and an explanatory note stay below); 4 Makeup VTO steps rendered live on 11/2 (34u incl. 3 analyses). What-if now previews the remaining branches (inner double, hooded, lips) on the double-lid face. Tests in compare.test.ts |
| S5 | 05 S5 | KO/EN toggle | match | m-home-en |
| F8 | 05 F8 | Unit guard, cache, mock mode, remaining shown | match | Banner + remaining units |
| F8b | s2 M3 "유닛이 부족하면 '샘플 모델로 보기'" | Visitor can choose the sample model instead of a selfie, 0 units | match (2026-11-02) | "샘플 모델로 체험하기 · 0 유닛" on home (bottom bar / under "두 얼굴 비교") and on capture + consent sheet. Full flow analyze → lesson (the sample model pre-generated VTO steps) → grade (stock attempt model-a/step-3) → shop → share, sample banner on every screen, profile kept in memory only (saved profile/streak untouched). Server: `sample=1` on /api/analyze and /api/render goes to lib/services/sample.ts, which takes no Runtime/transport; edits or ±20% fall back to the local preview on the sample model (still 0u). tests/unit/sample.test.ts (trap transport: 0 YouCam calls, even in live config). CDP run 390 mobile + 1440: /api/credit sessionSpent 0, remaining unchanged |
| F9 | 05 F9 | Consent, EXIF strip, profile delete | match | Home delete button |
| A-flow | 06 flow A | capture, analyze, confirm, lesson, grade, shop, share | match | driven end to end |
| B-flow | 06 flow B | Profile restored, no re-analysis | match | m-home-return |
| TEST | 08 | tests/typecheck/lint | match | r2: 178 pass, typecheck and lint 0 errors |
| S1 | 05 S1 | Landmark-aligned per-region deltaE grading, on-device | match | r2 m-grade: 4 regions with scores, footnote "얼굴 랜드마크로 맞춘 부위별 색차 ΔE" |
| X1 | 05 X1 | Base shade guide from skin tone | match | r2 m-analyze: "27호 웜 #C99B78" card with shade caveat |
| X2 | 05 X2 | Hair color finish (stretch) | gap | Not implemented; stretch item, low priority |
| X3 | 05 X3 | Creator-mode lesson JSON editor (stretch) | gap | Not implemented; stretch item, low priority |
| X4 | 05 X4 | Local practice log and score trend | match | r2 d-home2 past results + /record |
| M2-note | s1 M2 | Analyzing screen shows "사진은 저장하지 않아요" privacy line | match | 120x160 thumbnail beside progress, privacy line directly under steps, skeleton cards above fold (fix-r2/m-analyzing) |
| WIN-home | s4 Home / M1 | First screen shows value visually | match | Before/after sample (original vs answer) at top, links to /compare; desktop two-column hero (fix-r2/m-home, d-home) |
| WIN-mock | mock mode | Mock answer image looks like a real render | match | Base/cheek/contour overlays much fainter, fainter still without face anchors; test in anchors.test.ts (fix-r2/m-shop). A faint patch may remain on close-ups; live mode unaffected |
| R3-run | all screens | Full flow driven at 390px and 1440px (home, consent, capture, analyzing, result, edit sheet, lesson, shop, grade, share, record, compare) | match | r3: shots-r3 (scratchpad), tests 180/180, typecheck and lint clean |
| R3-win-mock | lesson/share mock | Mock answer images show a gray smudge under the eye (step 3) and the share-card "original" panel carries a pale base patch | match | Eye liner/shadow overlay opacity lowered in mockRender (test in anchors.test.ts); share-card original panel is the raw photo and shows no patch (r5 polish shots). Live mode unaffected |
| R4-run | all screens | Round 4 confirmation: home, consent, capture, analyzing, result, lesson re-driven at 390px and 1440px (model-b, mock mode) | match | scratchpad converge/mirror-tutor/shots/r4-*; tests 180/180, typecheck and lint clean |
| R4-stepper | s2 M3 | Stepper shows done / active / pending dots | match | Dots now active / done (earlier steps viewed) / pending (numbered, dashed) via lib/stepper.ts; render state no longer shows as a check; tests/unit/stepper.test.ts |
| P7-cycle2 | s4 Home / sample trial | Sample button visible above the fold and visually distinct at 390x844 and 1440x900; sample flow, compare KO/EN re-driven | match (2026-11-02) | Headless Chrome CDP, mock server: home headline + two-face hero + sticky Start / sample buttons above the fold; the sample button uses the tinted `soft` variant (was ghost). analyze → lesson 1-4 → grade (91) → shop → share and /compare KO+EN (correction chip) driven at 390 and 1440, no console errors, no horizontal overflow, 195 tests, typecheck and lint clean |
| A1-partner | Business case / Potential Impact | Retailer view as a screen | match (2026-11-02) | /partner (home link "See the retailer view (concept)"): fictional "MT Select" product page with the lesson widget (real pre-generated VTO steps of the monolid stock face, step buttons, "Open the lesson" starts the 0-unit sample), one-line integration snippet labelled illustrative (no SDK published), unit meter 14 then 4 under the 20 cap (from lib/units.ts), KPI strip chip "Hypothesis · not measured" with "No data yet" and no numbers. KO and EN driven at 390 and 1440 with CDP, no overflow, no console errors; tests/unit/partner.test.ts |
| S1-favicon | Site | /favicon.ico 404 | match (2026-11-02) | app/icon.svg (sparkle mark in the app's primary color on canvas) served by Next as /icon.svg and linked from the head |
