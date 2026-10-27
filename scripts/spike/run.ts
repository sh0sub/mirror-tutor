/**
 * D1 spikes #1–#4 / #6 — real YouCam calls. NOT run in CI; needs a key.
 *
 *   1) put YOUCAM_API_KEY=... in .env (repo root, gitignored)
 *   2) put a frontal selfie of yourself (or a consenting model) at .local/face.jpg
 *      (more photos: SPIKE_FACE_IMAGE=.local/a.jpg,.local/b.jpg — monolid / double / hooded if possible)
 *   3) npm run spike -- all          (or: credit | cost | catalog | face | vto, comma-joined e.g. face,vto)
 *
 * Knobs: SPIKE_FACE_RUNS (successful Face Analyzer runs wanted, default 3; images are tried in order and an
 * angle error moves on to the next one), SPIKE_VTO_MODE=seq (only the 4 sequential steps, no parallel run / probes).
 * Sections in docs/api-notes.md are merged by title, so a partial run keeps the other sections.
 *
 * Unit guard: at most SPIKE_MAX_UNITS (default 55) per run AND in total across runs (.local/spike-ledger.json).
 * Plan for `all`: Face Analyzer ×3 (30u) + VTO 4 sequential + 4 parallel (8u) + 2 colorNum probes (≤2u) = ≤40u.
 * Results: docs/api-notes.md (auto section) and fixtures/youcam/live/*.json, URLs and ids redacted.
 * Face images are only read from .local/ and never written anywhere.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHttpTransport, totalCredit, YouCamHttpError, type YouCamTransport } from "../../lib/youcam/client";
import { uploadImage } from "../../lib/youcam/file";
import { FACE_FEATURE, buildFaceAnalyzerRequest, normalizeFaceAttributes } from "../../lib/youcam/faceAnalyzer";
import { VTO_FEATURE, buildVtoRequest, extractResultUrl, type Effect } from "../../lib/youcam/makeupVto";
import { pollTask, YouCamTaskError } from "../../lib/youcam/poll";
import { sanitizeImage } from "../../lib/privacy/sanitize";
import { buildLesson } from "../../lib/lessons";
import { faceAnalyzerCost, MAKEUP_VTO_COST, FACE_FEATURE_COUNT } from "../../lib/units";
import type { FaceAttrResults, MakeupVtoResults } from "../../lib/youcam/types";
import { fetchCatalog } from "./catalog";
import { SpikeBudget, redactForDocs, stats } from "./budget";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NOTES = path.join(ROOT, "docs/api-notes.md");
const LIVE = path.join(ROOT, "fixtures/youcam/live");
const START = "<!-- spike:auto:start -->";
const END = "<!-- spike:auto:end -->";

type Section = { title: string; body: string };
const sections: Section[] = [];
const note = (title: string, body: string) => {
  sections.push({ title, body });
  console.log(`\n## ${title}\n${body}`);
};
const json = (v: unknown) => "```json\n" + JSON.stringify(redactForDocs(v), null, 2) + "\n```";

function saveFixture(name: string, data: unknown) {
  mkdirSync(LIVE, { recursive: true });
  writeFileSync(path.join(LIVE, `${name}.json`), JSON.stringify(redactForDocs(data), null, 2) + "\n");
}

function faceImages(): string[] {
  const list = (process.env.SPIKE_FACE_IMAGE ?? ".local/face.jpg").split(",").map((s) => s.trim()).filter(Boolean);
  return list.map((p) => {
    const abs = path.resolve(ROOT, p);
    if (!abs.startsWith(path.join(ROOT, ".local") + path.sep)) throw new Error(`face images must live in .local/ (got ${p})`);
    if (!existsSync(abs)) throw new Error(`missing ${p} — put a frontal selfie there (it stays local)`);
    return abs;
  });
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

async function spikeCredit(t: YouCamTransport) {
  try {
    const c = await t.getCredit();
    saveFixture("credit", c);
    note("#3 잔량 (GET /s2s/v1.0/client/credit, 0u)", `잔량 합계: **${totalCredit(c)}u**\n\n${json(c)}`);
    return totalCredit(c);
  } catch (e) {
    note("#3 잔량 (GET /s2s/v1.0/client/credit)", `실패: ${e instanceof Error ? e.message : e}\n(문서상 v1은 access_token 인증 — V2 API 키로 401이면 credit 조회 방식을 바꿔야 함)`);
    return null;
  }
}

async function spikeCost(t: YouCamTransport) {
  const skus: Array<{ description: string; amount: number; unit: string; proc_unit: number; run_task_url: string }> = [];
  let token: string | null | undefined = null;
  for (let page = 0; page < 20; page++) {
    const r = await t.getFeatureCost(token);
    skus.push(...(r.result?.skus ?? []));
    token = r.result?.next_token;
    if (!token) break;
  }
  saveFixture("feature-cost", { skus });
  const expected: Record<string, number> = { "face-attr-analysis": faceAnalyzerCost(FACE_FEATURE_COUNT), "makeup-vto": MAKEUP_VTO_COST, "hair-color": 1, "skin-tone-analysis": 20 };
  const rows = skus.map((s) => {
    const feat = s.run_task_url.split("/task/")[1] ?? "";
    const exp = expected[feat];
    return `| ${s.description} | ${feat} | ${s.amount} / ${s.proc_unit} ${s.unit} | ${exp === undefined ? "—" : exp === s.amount ? "일치" : `**불일치 (계획 ${exp})**`} |`;
  });
  note(
    "#3 feature-cost 대조 (GET /s2s/v2.0/credit/feature-cost, 0u)",
    ["| SKU | task | 단가 | 계획서 대비 |", "|---|---|---|---|", ...rows].join("\n") +
      "\n\nFace Analyzer는 SKU가 속성 수 구간별로 나뉠 수 있음 — 1~5개 구간이 10u인지 확인.",
  );
}

async function spikeCatalog() {
  const c = await fetchCatalog();
  const colorNum = (cat: string) => {
    const counts: Record<string, number> = {};
    for (const p of c.categories[cat]) counts[String(p.colorNum ?? "-")] = (counts[String(p.colorNum ?? "-")] ?? 0) + 1;
    return Object.entries(counts).map(([k, v]) => `${k}색 ${v}개`).join(", ");
  };
  note(
    "#1 패턴 카탈로그 (0u)",
    `조회 경로: \`${c.source}/patterns/{blush,eyeshadow,eyeliner,eyebrows,contour,highlighter,lipliner}.json\`, 입술 모양은 \`/shapes/lipshape.json\` (공개 JSON, 인증 불필요).\n\n- eye_shadow: ${colorNum("eye_shadow")}\n- blush: ${colorNum("blush")}\n- eye_liner: ${colorNum("eye_liner")}\n\n규칙표·레슨이 쓰는 label은 tests/unit/rules.test.ts가 전수 검증한다.`,
  );
}

async function spikeFace(t: YouCamTransport, budget: SpikeBudget, runs: number) {
  const imgs = faceImages();
  const latencies: number[] = [];
  const eyelids = new Set<string>();
  const fileIds: string[] = [];
  const results: unknown[] = [];
  const errors: string[] = [];
  let okFileId: string | undefined;
  const attempts = Math.max(runs, imgs.length);
  for (let i = 0; i < attempts && results.length < runs; i++) {
    const src = imgs[i % imgs.length];
    const clean = (await sanitizeImage(new Uint8Array(readFileSync(src)))).bytes;
    const fileId = await uploadImage(t, clean);
    fileIds.push(fileId);
    const cost = faceAnalyzerCost(FACE_FEATURE_COUNT);
    budget.reserve(cost, `face-attr-analysis #${i + 1}`);
    try {
      const { value, ms } = await timed(async () => {
        const { data } = await t.runTask(FACE_FEATURE, buildFaceAnalyzerRequest(fileId));
        return pollTask<FaceAttrResults>(t, FACE_FEATURE, data.task_id, { timeoutMs: 60_000 });
      });
      latencies.push(ms);
      results.push(value);
      okFileId ??= fileId;
      [value.eyelid?.left_eyelid, value.eyelid?.right_eyelid].forEach((v) => v && eyelids.add(v));
      saveFixture(`face-attr-analysis.run${i + 1}`, value);
      console.log(`face #${i + 1}: ${ms}ms → ${JSON.stringify(normalizeFaceAttributes(value).profile)}`);
    } catch (e) {
      if (e instanceof YouCamTaskError || e instanceof YouCamHttpError) {
        budget.refund(cost, `face #${i + 1} error ${e.code}`);
        errors.push(`${path.basename(src)}: ${e.code}`);
      }
      console.log(`face #${i + 1} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  note(
    "#2 / #4 Face Analyzer 실측",
    `요청: face_angle_strictness_level=\`${buildFaceAnalyzerRequest("x").face_angle_strictness_level}\` · 성공 ${results.length}회 / 시도 ${results.length + errors.length}회${errors.length ? ` · 오류(0u): ${errors.join(", ")}` : ""}\n\n` +
      `지연(초, 업로드 제외, task 생성~success): ${JSON.stringify(stats(latencies))}\n\n` +
      `eyelid 값 집합(관측): ${[...eyelids].join(", ") || "—"} (문서 enum: Hooded-lid, Single-lid, Double-lid, Deep-Set)\n\n` +
      `정규화 결과: ${results.map((r) => JSON.stringify(normalizeFaceAttributes(r as FaceAttrResults).profile)).join("<br>")}\n\n첫 응답:\n${json(results[0] ?? null)}`,
  );
  return okFileId ?? fileIds[0];
}

async function vtoOnce(t: YouCamTransport, budget: SpikeBudget, fileId: string, effects: Effect[], label: string) {
  budget.reserve(MAKEUP_VTO_COST, label);
  try {
    return await timed(async () => {
      const { data } = await t.runTask(VTO_FEATURE, buildVtoRequest(fileId, effects));
      const results = await pollTask<MakeupVtoResults>(t, VTO_FEATURE, data.task_id, { timeoutMs: 60_000 });
      return { results, url: extractResultUrl(results) };
    });
  } catch (e) {
    if (e instanceof YouCamTaskError || e instanceof YouCamHttpError) budget.refund(MAKEUP_VTO_COST, `${label} error ${e.code}`);
    throw e;
  }
}

async function spikeVto(t: YouCamTransport, budget: SpikeBudget, fileIdIn?: string) {
  const fileId = fileIdIn ?? (await uploadImage(t, (await sanitizeImage(new Uint8Array(readFileSync(faceImages()[0])))).bytes));
  const plan = buildLesson("daily-k", { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" });

  const seq: number[] = [];
  let firstResults: unknown = null;
  for (const s of plan.steps) {
    try {
      const r = await vtoOnce(t, budget, fileId, s.cumulativeEffects, `vto seq step ${s.index}`);
      seq.push(r.ms);
      firstResults ??= r.value.results;
    } catch (e) {
      console.log(`vto step ${s.index} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  saveFixture("makeup-vto.result-shape", firstResults);
  const seqOnly = process.env.SPIKE_VTO_MODE === "seq";
  if (seqOnly) {
    note(
      "#2 Makeup VTO 실측 (데일리 K-룩 홑꺼풀 분기, 같은 file_id)",
      `단건 순차 지연(초): ${JSON.stringify(stats(seq))} · 성공 ${seq.length}/${plan.steps.length}단계 (SPIKE_VTO_MODE=seq: 병렬·프로브 생략)\n\n` +
        `결과 필드 모양:\n${json(firstResults)}\n\n` +
        `라이브 확인 규칙(2026-10-27, 오류 응답 error_message): eyebrows shape 패턴은 curvature·thickness·definition 필수 / lip_color ombre는 style.innerColorRatio·blendStrength(문서 예시의 innerRatio·featherStrength 아님) + palettes 2개 필수 / blush는 palettes 수 = colorNum 강제(eye_shadow는 불일치 허용).`,
    );
    return;
  }

  const par = await timed(() =>
    Promise.allSettled(plan.steps.map((s) => vtoOnce(t, budget, fileId, s.cumulativeEffects, `vto parallel step ${s.index}`))),
  );
  const parOk = par.value.filter((r) => r.status === "fulfilled").length;

  // #1 colorNum probes: does the API reject a palette count that differs from colorNum? (errors are free)
  const probes: string[] = [];
  for (const [label, effects] of [
    ["eye_shadow 2colors1 + 1 palette", [{ category: "eye_shadow", pattern: { name: "2colors1" }, palettes: [{ color: "#D9A58E", colorIntensity: 50, texture: "matte" }] }]],
    ["blush 1color1 + 2 palettes", [{ category: "blush", pattern: { name: "1color1" }, palettes: [{ color: "#E79A9A", colorIntensity: 40, texture: "matte" }, { color: "#D06060", colorIntensity: 40, texture: "matte" }] }]],
  ] as Array<[string, Effect[]]>) {
    try {
      await vtoOnce(t, budget, fileId, effects, `probe ${label}`);
      probes.push(`${label}: **success (1u)** → 서버는 colorNum 불일치를 허용`);
    } catch (e) {
      probes.push(`${label}: error \`${e instanceof YouCamTaskError || e instanceof YouCamHttpError ? e.code : String(e)}\` (0u) → colorNum 강제`);
    }
  }

  note(
    "#2 Makeup VTO 실측 (데일리 K-룩 홑꺼풀 분기, 같은 file_id)",
    `단건 순차 지연(초): ${JSON.stringify(stats(seq))}\n\n4건 병렬 전체: ${(par.ms / 1000).toFixed(1)}초, 성공 ${parOk}/4\n\n` +
      `결과 필드 모양(스키마 \`results.url\` vs 본문 \`results[].download_url\`):\n${json(firstResults)}\n\n` +
      `colorNum 프로브:\n${probes.map((p) => `- ${p}`).join("\n")}\n\n` +
      `판단 가이드: 단건 평균이 폴링 최대 30초의 절반을 넘으면 DEFAULT_POLL.timeoutMs를 올린다. 병렬이 단건보다 크게 길지 않으면 스켈레톤→순차 공개 UX 유지.`,
  );
}

function writeNotes(spent: number, budget: SpikeBudget) {
  const header = `_자동 생성: ${new Date().toISOString()} · 이번 실행 ${spent}u · 누적 ${budget.ledgerTotal}u / ${budget.maxTotal}u_`;
  const prev = existsSync(NOTES) ? readFileSync(NOTES, "utf8") : "# YouCam API notes\n";
  // Merge by title: sections from this run replace same-titled ones, earlier sections are kept.
  const kept = new Map<string, string>();
  const old = prev.match(new RegExp(`${START}([\\s\\S]*?)${END}`))?.[1] ?? "";
  for (const chunk of old.split(/\n(?=### )/)) {
    const m = chunk.match(/^### (.+)\n([\s\S]*)$/);
    if (m) kept.set(m[1].trim(), m[2].trim());
  }
  for (const s of sections) kept.set(s.title, s.body);
  const auto = [START, header, ...[...kept].map(([title, body]) => `### ${title}\n\n${body}`), END].join("\n\n");
  const next = prev.includes(START) ? prev.replace(new RegExp(`${START}[\\s\\S]*?${END}`), () => auto) : `${prev.trimEnd()}\n\n## 실호출 결과 (scripts/spike/run.ts)\n\n${auto}\n`;
  writeFileSync(NOTES, next);
  console.log(`\nwrote docs/api-notes.md and fixtures/youcam/live/ (spent ${spent}u)`);
}

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    /* no .env */
  }
  const cmd = process.argv[2] ?? "all";
  const cmds = new Set(cmd.split(","));
  const has = (c: string) => cmds.has(c) || cmds.has("all");
  const apiKey = process.env.YOUCAM_API_KEY?.trim();
  if (cmd === "catalog") {
    await spikeCatalog();
    writeNotes(0, new SpikeBudget(0, 0, null));
    return;
  }
  if (!apiKey) throw new Error("YOUCAM_API_KEY is not set (.env) — spikes need a real key; nothing was called");
  const max = Number(process.env.SPIKE_MAX_UNITS ?? 55);
  const budget = new SpikeBudget(max, max, path.join(ROOT, ".local/spike-ledger.json"));
  const t = createHttpTransport({ apiKey });

  const remaining = await spikeCredit(t);
  if (remaining !== null && remaining < max) throw new Error(`balance ${remaining}u is below the spike cap ${max}u — stopping`);
  if (cmd === "credit") return writeNotes(0, budget);
  if (has("cost")) await spikeCost(t);
  if (cmds.has("all")) await spikeCatalog();
  let fileId: string | undefined;
  if (has("face")) fileId = await spikeFace(t, budget, Number(process.env.SPIKE_FACE_RUNS ?? 3));
  if (has("vto")) await spikeVto(t, budget, fileId);
  writeNotes(budget.spent, budget);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  if (sections.length) writeNotes(0, new SpikeBudget(0, 0, null));
  process.exit(1);
});
