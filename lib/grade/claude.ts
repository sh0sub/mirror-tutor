import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { GRADE_REGIONS, type GradeRegion } from "../regions";
import { REGION_NAME, type GradeResult } from "./types";
import type { LocalMeasure } from "./local";

/**
 * F6 LLM grader: Claude vision compares answer/attempt crops per region against a fixed rubric and
 * returns JSON {region, score, tip, confidence}. The local ΔE measurements are passed as numeric
 * evidence. Model: claude-opus-5-5 (override with GRADER_MODEL). Server-side refusal fallback is on.
 */

export const RUBRIC = `You grade a makeup practice attempt against an answer image for the same person.
For each region you get two crops: ANSWER (the target look rendered by a virtual try-on) and ATTEMPT (the user's real photo).
Score 0-100 how closely the ATTEMPT matches the ANSWER in color, intensity, placement and shape for that region only.
Rubric per region: 90-100 = indistinguishable; 75-89 = close, one small fix; 50-74 = clearly different in one aspect; 0-49 = missing or very different.
Ignore skin texture, identity, hair and background. Do not comment on the person's appearance; only on the makeup.
"tip_ko"/"tip_en": one short, kind next action (max 40 characters in Korean, 70 in English), e.g. "꼬리를 가로로 2~3mm" / "Extend the tail 2-3 mm straight out".
"confidence": "low" if lighting, angle or blur makes the comparison unreliable, else "medium" or "high".
Measured CIEDE2000 color differences between the crops are given as evidence; a large ΔE usually means a lower score.`;

const RegionSchema = z.object({
  region: z.enum(["eye_line", "eye_lid", "cheek", "lip"]),
  score: z.number().int().min(0).max(100),
  tip_ko: z.string().min(1).max(80),
  tip_en: z.string().min(1).max(140),
  confidence: z.enum(["high", "medium", "low"]),
});
const OutputSchema = z.object({ regions: z.array(RegionSchema).length(4) });

export const OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["regions"],
  properties: {
    regions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["region", "score", "tip_ko", "tip_en", "confidence"],
        properties: {
          region: { type: "string", enum: ["eye_line", "eye_lid", "cheek", "lip"] },
          score: { type: "integer" },
          tip_ko: { type: "string" },
          tip_en: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
} as const;

export interface ClaudeGradeInput {
  answerCrops: Record<GradeRegion, string>;
  attemptCrops: Record<GradeRegion, string>;
  measure: LocalMeasure;
}

/** Minimal surface of the SDK call so tests can stub it. */
export type CreateMessage = (params: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage>;

export function buildGradeRequest(input: ClaudeGradeInput, model: string): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const r of GRADE_REGIONS) {
    const dE = input.measure.regions.find((x) => x.region === r)?.deltaE;
    content.push({ type: "text", text: `Region: ${r} (${REGION_NAME[r].en}). Measured ΔE2000 = ${dE ?? "n/a"}. ANSWER then ATTEMPT:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: input.answerCrops[r] } });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: input.attemptCrops[r] } });
  }
  content.push({ type: "text", text: "Return the JSON for all four regions." });
  return {
    model,
    max_tokens: 4000,
    system: RUBRIC,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown> } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
}

export function parseGradeResponse(msg: Anthropic.Beta.BetaMessage, measure: LocalMeasure): GradeResult {
  if (msg.stop_reason === "refusal") throw new Error("grader refused");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = OutputSchema.parse(JSON.parse(text));
  const byRegion = new Map(parsed.regions.map((r) => [r.region, r]));
  const regions = GRADE_REGIONS.map((region) => {
    const r = byRegion.get(region);
    if (!r) throw new Error(`grader missed region ${region}`);
    return { region, score: r.score, tip: { ko: r.tip_ko, en: r.tip_en }, deltaE: measure.regions.find((m) => m.region === region)?.deltaE ?? 0 };
  });
  const llmLow = parsed.regions.some((r) => r.confidence === "low");
  const confidence = llmLow || measure.confidence === "low" ? "low" : measure.confidence === "medium" || parsed.regions.some((r) => r.confidence === "medium") ? "medium" : "high";
  return {
    comparable: true,
    total: Math.round(regions.reduce((s, r) => s + r.score, 0) / regions.length),
    confidence,
    confidenceReason: confidence === "high" ? null : (measure.confidenceReason ?? { ko: "사진 조건이 정답과 달라요", en: "Photo conditions differ from the answer" }),
    regions,
    grader: "claude",
    units: 0,
  };
}

export function anthropicCreate(apiKey: string): CreateMessage {
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  return (params) => client.beta.messages.create(params);
}

export async function gradeWithClaude(input: ClaudeGradeInput, create: CreateMessage, model: string): Promise<GradeResult> {
  const msg = await create(buildGradeRequest(input, model));
  return parseGradeResponse(msg, input.measure);
}
