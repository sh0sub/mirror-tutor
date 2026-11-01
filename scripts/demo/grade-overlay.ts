/**
 * C10 video helper (0 YouCam units, no network): draws the four graded region masks on the answer and the attempt thumbnails
 * of an existing screencast frame of the grade screen, plus a highlight box around one delta-E line of a scrolled frame.
 *
 *   npx tsx scripts/demo/grade-overlay.ts <frames dir> <top frame> <scrolled frame> <out dir>
 *
 * The masks are the real polygons the app grades with (lib/grade/landmarks.ts, normalized MediaPipe landmarks of the
 * answer image, scripts/demo/model-a-landmarks.json). The attempt is the answer with a Lab shift inside those polygons,
 * so the same polygons fit both thumbnails. Both thumbnails are 3:4, shown at 175 css px wide in the 390 px frame.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { regionPolygons, type Pt } from "../../lib/grade/landmarks";
import { GRADE_REGIONS, type GradeRegion } from "../../lib/regions";

const [dir, topName, rowName, outDir] = process.argv.slice(2);
if (!outDir) throw new Error("usage: grade-overlay.ts <frames dir> <top frame> <scrolled frame> <out dir>");
const lm = JSON.parse(readFileSync(path.join(import.meta.dirname, "model-a-landmarks.json"), "utf8")) as Pt[];

const IMG_W = 600, IMG_H = 800;
const THUMB_W = 175, THUMB_H = (THUMB_W * 4) / 3, THUMB_Y = 72, ANSWER_X = 16, ATTEMPT_X = 199;
const COLORS: Record<GradeRegion, string> = { eye_line: "#ffd400", eye_lid: "#b45cff", cheek: "#19d3ff", lip: "#3ddc84" };
const k = THUMB_W / IMG_W;

function masks(x0: number): string {
  return GRADE_REGIONS.map((region) => {
    const d = regionPolygons(lm, region, IMG_W, IMG_H)
      .map((p) => [p.outer, ...(p.holes ?? [])].map((ring) => `M${ring.map((q) => `${(x0 + q.x * k).toFixed(1)},${(THUMB_Y + q.y * k).toFixed(1)}`).join("L")}Z`).join(""))
      .join("");
    return `<path d="${d}" fill="${COLORS[region]}" fill-opacity="0.45" stroke="${COLORS[region]}" stroke-width="1.3" fill-rule="evenodd"/>`;
  }).join("");
}
const pill = (x: number, text: string, fill: string, w: number) =>
  `<g><rect x="${x + (THUMB_W - w) / 2}" y="${THUMB_Y + THUMB_H - 28}" width="${w}" height="22" rx="11" fill="${fill}"/><text x="${x + THUMB_W / 2}" y="${THUMB_Y + THUMB_H - 12.5}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="12.5" fill="#fff" letter-spacing=".4">${text}</text></g>`;

const topSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844">${masks(ANSWER_X)}${masks(ATTEMPT_X)}${pill(ANSWER_X, "ANSWER KEY", "#c8325b", 112)}${pill(ATTEMPT_X, "SIMULATED ATTEMPT", "#1f1b1a", 160)}</svg>`;
// delta-E line of the Eyeliner card in the scrolled frame (frame px)
const rowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect x="60" y="309" width="268" height="26" rx="8" fill="#c8325b" fill-opacity="0.10" stroke="#c8325b" stroke-width="2.5"/></svg>`;

await sharp(path.join(dir, topName)).composite([{ input: Buffer.from(topSvg) }]).jpeg({ quality: 93 }).toFile(path.join(outDir, "grade-top.jpg"));
await sharp(path.join(dir, rowName)).composite([{ input: Buffer.from(rowSvg) }]).jpeg({ quality: 93 }).toFile(path.join(outDir, "grade-row.jpg"));
console.log("wrote", outDir);
