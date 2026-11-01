/**
 * C11: writes public/demo/sample-grades.json, the offline grade of each simulated sample attempt, so the sample trial shows
 * its result at once instead of re-running a 5 s on-device grading whose answer never changes.
 *
 *   npx tsx scripts/demo/make-sample-grades.ts <capture.json>
 *
 * <capture.json> = { "<attempt path>": <the /api/grade response the app itself got for that attempt> }, taken from the real grading
 * flow (browser MediaPipe landmark ΔE → POST /api/grade, rule tips, mock server) on the answer image of each sample variant. The
 * score-label points on the attempt photo come from the same landmarks (scripts/demo/<model>-landmarks.json, the attempt is a
 * recolor of the answer so the geometry is identical). Live grading is unchanged; only the 0-unit sample trial plays this back.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gradePinsFromLandmarks } from "../../lib/facePins";
import type { GradeResult } from "../../lib/grade/types";

const ROOT = path.resolve(import.meta.dirname, "../..");
const capture = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, GradeResult>;
const out: Record<string, { grade: GradeResult; pins: ReturnType<typeof gradePinsFromLandmarks> }> = {};
for (const [attempt, grade] of Object.entries(capture)) {
  const model = /^\/demo\/(model-[a-z])\//.exec(attempt)![1];
  const lm = JSON.parse(readFileSync(path.join(import.meta.dirname, `${model}-landmarks.json`), "utf8")) as { x: number; y: number }[];
  out[attempt] = { grade, pins: gradePinsFromLandmarks(lm) };
}
writeFileSync(path.join(ROOT, "public/demo/sample-grades.json"), JSON.stringify(out, null, 1) + "\n");
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.grade.total}`).join("\n"));
