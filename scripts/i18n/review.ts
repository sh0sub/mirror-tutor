/**
 * S5 (#21) one-shot English review: sends every ko/en UI string pair (UI dictionary, F2 attribute
 * labels/hints, rule-table labels/reasons, lesson copy, photo-guide messages) to Claude once and
 * writes suggested English fixes to .local/i18n-review.json (gitignored). A human then applies the
 * accepted fixes to the source files — the app never calls an LLM for translation at runtime.
 *
 *   npx tsx scripts/i18n/review.ts          (needs ANTHROPIC_API_KEY in .env; costs one API call)
 *   npx tsx scripts/i18n/review.ts --dry    (prints the entry count only, no call)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { readConfig } from "../../lib/config";
import { collectEntries, REVIEW_SCHEMA, REVIEW_SYSTEM, type ReviewResult } from "../../lib/i18nReview";

const ROOT = path.resolve(import.meta.dirname, "../..");

async function main() {
  const entries = collectEntries();
  console.log(`entries: ${entries.length}`);
  if (process.argv.includes("--dry")) return;
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    /* no .env */
  }
  const cfg = readConfig();
  if (!cfg.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set (.env) — nothing was called");

  const client = new Anthropic({ apiKey: cfg.anthropicKey, maxRetries: 1 });
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 64000,
    system: REVIEW_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(entries) }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: REVIEW_SCHEMA as unknown as Record<string, unknown> } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("review refused");
  if (msg.stop_reason === "max_tokens") throw new Error("review truncated (max_tokens)");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const result = JSON.parse(text) as ReviewResult;
  await mkdir(path.join(ROOT, ".local"), { recursive: true });
  const out = path.join(ROOT, ".local/i18n-review.json");
  await writeFile(out, JSON.stringify({ model: msg.model, usage: msg.usage, ...result }, null, 2));
  const changed = result.items.filter((i) => i.en !== entries.find((e) => e.id === i.id)?.en);
  console.log(`changed suggestions: ${changed.length} → ${path.relative(ROOT, out)}`);
  console.log(`usage: in ${msg.usage.input_tokens} / out ${msg.usage.output_tokens}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
