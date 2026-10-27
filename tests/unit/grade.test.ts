import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { gradeLocal, scoreFromDeltaE } from "@/lib/grade/local";
import { buildGradeRequest, parseGradeResponse } from "@/lib/grade/claude";
import { gradeAttempt } from "@/lib/services/grade";
import { mockRenderEffects } from "@/lib/youcam/mockRender";
import { buildLesson } from "@/lib/lessons";
import { scoreBand } from "@/lib/grade/types";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { POST } from "@/app/api/grade/route";
import type { FaceProfile } from "@/lib/profile";
import type Anthropic from "@anthropic-ai/sdk";
import { syntheticSelfie } from "../helpers";

const profile: FaceProfile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" };

async function answerAndAttempts() {
  const bare = await syntheticSelfie();
  const effects = buildLesson("daily-k", profile).steps[3].cumulativeEffects;
  const answer = await mockRenderEffects(bare, effects);
  return { bare, answer };
}

afterEach(() => setRuntime(undefined));

describe("F6 local grader (ΔE evidence, 0 units)", () => {
  it("an attempt identical to the answer scores ~100 with high confidence", async () => {
    const { answer } = await answerAndAttempts();
    const r = await gradeLocal(answer, answer);
    expect(r.comparable).toBe(true);
    expect(r.total).toBeGreaterThanOrEqual(98);
    expect(r.confidence).toBe("high");
    expect(r.regions.map((x) => x.region)).toEqual(["eye_line", "eye_lid", "cheek", "lip"]);
    expect(r.units).toBe(0);
  });

  it("a bare face (no makeup) scores lower than the answer itself, with a next-action tip", async () => {
    const { bare, answer } = await answerAndAttempts();
    const r = await gradeLocal(answer, bare);
    expect(r.total!).toBeLessThan(98);
    const lip = r.regions.find((x) => x.region === "lip")!;
    expect(lip.deltaE).toBeGreaterThan(0);
    expect(lip.tip.ko.length).toBeGreaterThan(5);
  });

  it("lowers confidence when the lighting differs", async () => {
    const { answer } = await answerAndAttempts();
    const darker = new Uint8Array(await sharp(answer).modulate({ brightness: 0.6 }).jpeg().toBuffer());
    const r = await gradeLocal(answer, darker);
    expect(r.confidence).not.toBe("high");
    expect(r.confidenceReason?.ko).toBe("조명이 정답 촬영과 달라요");
  });

  it("refuses to invent numbers when the framing is too different (state ④)", async () => {
    const { answer } = await answerAndAttempts();
    const far = await syntheticSelfie({ faceWidth: 0.35 });
    const r = await gradeLocal(answer, far);
    expect(r).toMatchObject({ comparable: false, total: null, regions: [] });
  });

  it("score curve and bands", () => {
    expect(scoreFromDeltaE(0)).toBe(100);
    expect(scoreFromDeltaE(5)).toBe(80);
    expect(scoreFromDeltaE(30)).toBe(0);
    expect(scoreBand(78).ko).toBe("거의 다 왔어요");
  });
});

describe("F6 Claude grader (stubbed)", () => {
  const measure = {
    comparable: true,
    confidence: "medium" as const,
    confidenceReason: { ko: "조명이 정답 촬영과 달라요", en: "Lighting differs" },
    regions: (["eye_line", "eye_lid", "cheek", "lip"] as const).map((region) => ({ region, score: 80, tip: { ko: "", en: "" }, deltaE: 4.2 })),
  };
  const crops = { eye_line: "AA==", eye_lid: "AA==", cheek: "AA==", lip: "AA==" };

  it("sends 4 region crop pairs + rubric, structured output, model id, and refusal fallback", () => {
    const req = buildGradeRequest({ answerCrops: crops, attemptCrops: crops, measure }, "claude-opus-5-5");
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.output_config?.format?.type).toBe("json_schema");
    const content = req.messages[0].content as Array<{ type: string }>;
    expect(content.filter((c) => c.type === "image")).toHaveLength(8);
    expect(JSON.stringify(req.system)).toMatch(/Do not comment on the person's appearance/);
  });

  const reply = (text: string, stop: string = "end_turn") =>
    ({ content: [{ type: "text", text }], stop_reason: stop }) as unknown as Anthropic.Beta.BetaMessage;
  const regionsJson = JSON.stringify({
    regions: [
      { region: "eye_line", score: 71, tip_ko: "꼬리가 위로 올라갔어요 — 가로로 2~3mm", tip_en: "Tail goes up — extend 2-3 mm straight", confidence: "medium" },
      { region: "eye_lid", score: 82, tip_ko: "좋아요, 바깥쪽을 조금 더 흐리게", tip_en: "Blur the outer edge", confidence: "high" },
      { region: "cheek", score: 64, tip_ko: "광대 위로 손가락 한 마디", tip_en: "One finger higher", confidence: "high" },
      { region: "lip", score: 93, tip_ko: "경계가 자연스러워요", tip_en: "Natural edge", confidence: "high" },
    ],
  });

  it("parses the JSON into the mockup's 78/100 with medium confidence", () => {
    const r = parseGradeResponse(reply(regionsJson), measure);
    expect(r).toMatchObject({ grader: "claude", total: 78, confidence: "medium", comparable: true });
    expect(r.regions[0]).toMatchObject({ region: "eye_line", score: 71, deltaE: 4.2 });
  });

  it("rejects refusals and malformed output (caller falls back to local)", () => {
    expect(() => parseGradeResponse(reply(regionsJson, "refusal"), measure)).toThrow();
    expect(() => parseGradeResponse(reply('{"regions":[]}'), measure)).toThrow();
  });

  it("gradeAttempt uses Claude when configured and falls back to local on failure", async () => {
    const { bare, answer } = await answerAndAttempts();
    const ok = vi.fn(async () => reply(regionsJson));
    expect(await gradeAttempt(answer, bare, { create: ok })).toMatchObject({ grader: "claude", total: 78 });
    expect(ok).toHaveBeenCalledTimes(1);
    const boom = vi.fn(async () => Promise.reject(new Error("529")));
    expect(await gradeAttempt(answer, bare, { create: boom })).toMatchObject({ grader: "local" });
  });
});

describe("POST /api/grade", () => {
  it("grades two uploaded images with the local grader when no Anthropic key is set", async () => {
    setRuntime(createRuntime(readConfig({}), createMockTransport()));
    const { bare, answer } = await answerAndAttempts();
    const form = new FormData();
    form.set("answer", new Blob([Buffer.from(answer)], { type: "image/jpeg" }));
    form.set("attempt", new Blob([Buffer.from(bare)], { type: "image/jpeg" }));
    const res = await POST(new Request("http://x/api/grade", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ grader: "local", comparable: true, units: 0 });
  });
});
