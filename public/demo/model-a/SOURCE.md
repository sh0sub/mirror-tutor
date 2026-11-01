# model-a (double-lid face) — source

- Photo: a Pexels stock photo (Pexels License: free for commercial use, modification allowed). The original file is kept in `.local/face.jpg` (not committed); the page URL was not recorded when it was downloaded on 2026-10-29.
- Processing: cropped to 3:4, resized to 600x800 by `scripts/demo/generate.ts`; `step-1..4.jpg` are YouCam Makeup VTO renders of this face (cumulative lesson steps).
- `sample-attempt.jpg` (C9): a SIMULATED attempt, not a real selfie. `scripts/demo/make-sample-attempt.ts` takes `step-4.jpg` (the lesson answer) and applies a deterministic CIELAB shift inside each graded face-landmark polygon (liner lighter, eyelid deeper and pinker, base a touch lighter, lips lighter and more orange). 0 YouCam units; the app labels it as simulated on the grade screen.
