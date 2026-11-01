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
