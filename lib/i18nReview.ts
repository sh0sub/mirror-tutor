import { MESSAGES } from "./i18n";
import { ATTR_NAME, VALUE_HINT, VALUE_LABEL } from "./labels";
import { LESSONS } from "./lessons";
import { ISSUE_MESSAGE, guideText, type GuideKey } from "./quality/messages";
import table from "./rules/techniques.json";
import type { Text } from "./rules/engine";

/** One ko/en pair with a stable id ("dict.start", "rules.eye.monolid.why", …). */
export interface I18nEntry {
  id: string;
  ko: string;
  en: string;
}

const isText = (v: unknown): v is Text =>
  typeof v === "object" && v !== null && typeof (v as Text).ko === "string" && typeof (v as Text).en === "string";

function walk(prefix: string, node: unknown, out: I18nEntry[]) {
  if (isText(node)) {
    out.push({ id: prefix, ko: node.ko, en: node.en });
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(prefix ? `${prefix}.${k}` : k, v, out);
  }
}

const GUIDE_KEYS: GuideKey[] = ["angle_up", "angle_down", "turn", "tilt", "retry", "credit"];

/** Every user-facing bilingual string (S5 acceptance: UI copy + rule-table explanations + F2 one-liners). */
export function collectEntries(): I18nEntry[] {
  const out: I18nEntry[] = [];
  walk("dict", MESSAGES, out);
  walk("attr", ATTR_NAME, out);
  walk("value", VALUE_LABEL, out);
  walk("hint", VALUE_HINT, out);
  walk("rules", { eye: table.eye, eyeShape: table.eyeShape, lip: table.lip, cheek: table.cheek, contour: table.contour, brow: table.brow }, out);
  for (const l of LESSONS) {
    walk(`lesson.${l.id}`, { title: l.title, summary: l.summary }, out);
    for (const s of l.steps) walk(`lesson.${l.id}.${s.id}`, { title: s.title, instruction: s.instruction }, out);
  }
  walk("issue", ISSUE_MESSAGE, out);
  for (const g of GUIDE_KEYS) out.push({ id: `guide.${g}`, ko: guideText(g, "ko"), en: guideText(g, "en") });
  return out;
}

export const REVIEW_SYSTEM = `You review the English UI copy of "Mirror Tutor", a mobile web app that teaches K-makeup on the user's own face (YouCam Face Analyzer + Makeup VTO). Audience: overseas K-beauty fans, casual and international. The Korean is the source of truth.
For every entry you get {id, ko, en}. Return the same id with the best English:
- Faithful to the Korean meaning, including numbers, units (mm, %, "units" = API credits) and placeholders like {n} kept exactly.
- Tone: a warm coach — short, friendly, the next action first, never scolding, never comment on the person's looks.
- Consistent terms across all entries: monolid, inner double lid, double lid, hooded lid, crease, liner, shadow, blush, contour, gradient lips, units, answer (= the rendered target image), attempt.
- Keep UI labels as short as the current English (buttons ≤ 3 words where possible). Plain words over jargon.
- If the current English is already good, return it unchanged. Put a short reason in "note" only when you changed it (else empty string).`;

export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "en", "note"],
        properties: { id: { type: "string" }, en: { type: "string" }, note: { type: "string" } },
      },
    },
  },
} as const;

export interface ReviewResult {
  items: Array<{ id: string; en: string; note: string }>;
}
