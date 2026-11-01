# model-c (monolid face) — source

- Photo: "Woman in white and black polka dot shirt"
- Source URL: https://unsplash.com/photos/woman-in-white-and-black-polka-dot-shirt-KRBHTbLTMDs
- Photographer: Peter John Manlapig (https://unsplash.com/@istream)
- License: Unsplash License (https://unsplash.com/license): free for commercial and non-commercial use, modification allowed, no attribution required. Not an Unsplash+ image. Credited here anyway.
- Downloaded: 2026-11-02, original 3648×5472 JPEG.
- Processing: cropped to 3:4 around the face, resized to 1200×1600 (passes the app's quality gate: face width 67%), then `scripts/demo/generate.ts --only model-c` wrote the 600×800 copies here (re-encoded, EXIF/ICC stripped). The full-size source is not committed.

## Analysis and correction

YouCam Face Analyzer read this face as `Double-lid / Double-lid` (2026-11-02). The eyelid was corrected to `monolid`, the same correction a user can make on the analysis results screen (M2 "Edited"). Then the rule table and 4 Makeup VTO steps ran on that profile. `compare.json` keeps the analyzer's raw reading in `source.eyelid` and marks the field in `edited: ["eyelid"]`, and /compare shows "Face Analyzer read Double-lid → edited".

Other attempts that day: a Pexels monolid photo (https://www.pexels.com/photo/portrait-photo-of-woman-4672555/) was also read as `Double-lid / Double-lid`, and a third photo's analysis timed out. Neither is used.

## Gradient pair (C7)

`eye-horizontal.jpg` and `eye-vertical.jpg` are two extra Makeup VTO renders of this face (cumulative step 3, same colors and liner, shadow intensity 100) made by `scripts/demo/generate-vertical.ts`: shadow style `2colors1` (this app's monolid rule, "horizontal") and `2colors3` (the double-lid rule's style, used as the "vertical" generic-tutorial technique). The horizontal/vertical names are ours, not YouCam's. The eyelid was the corrected value (monolid). Same license and processing as above.

## Sample trial assets (C11)

- `raw-step-1..4.jpg`: the daily-k lesson's 4 cumulative Makeup VTO steps on Face Analyzer's raw reading (`Double-lid`, uncorrected), made by `scripts/demo/generate-raw.ts` (4 units). The monolid sample trial plays them when the visitor keeps the analyzer's reading and opens the lesson; the corrected steps are `step-1..4.jpg`.
- `sample-attempt.jpg` and `sample-attempt-raw.jpg`: simulated attempts, `step-4.jpg` / `raw-step-4.jpg` with a deterministic off-shade recolor inside each graded landmark region (`scripts/demo/make-sample-attempt.ts model-c`). Not real photos of anyone; derived from this stock photo, same license.
