import { afterEach, describe, expect, it } from "vitest";
import { buildFaceAnalyzerRequest, mapBrowShape, mapEyelid, mapFaceShape, mapLipShape, normalizeFaceAttributes } from "@/lib/youcam/faceAnalyzer";
import { analyzeFace } from "@/lib/services/analyze";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport, type MockOptions } from "@/lib/youcam/mock";
import { sha256 } from "@/lib/cache";
import { sanitizeImage } from "@/lib/privacy/sanitize";
import { POST } from "@/app/api/analyze/route";
import type { FaceAttrResults } from "@/lib/youcam/types";
import monolid from "@/fixtures/youcam/face-attr-analysis.monolid.spec.json";
import double from "@/fixtures/youcam/face-attr-analysis.double.spec.json";
import { syntheticSelfie } from "../helpers";

const fast = { sleep: async () => {} };
const rtWith = (opts: MockOptions = {}, env: Record<string, string> = {}) =>
  createRuntime(readConfig(env), createMockTransport({ render: async (s) => s, ...opts }));

afterEach(() => setRuntime(undefined));

describe("Face Analyzer request + normalization", () => {
  it("asks for exactly the 5 planned features by file id", () => {
    expect(buildFaceAnalyzerRequest("f1")).toEqual({
      src_file_id: "f1",
      features: ["eyelid", "eyeShape", "lipShape", "faceShape", "eyebrowShape"],
      face_angle_strictness_level: "flexible",
    });
  });

  it("normalizes the documented value sets", () => {
    expect(normalizeFaceAttributes(monolid.data.results as FaceAttrResults).profile).toEqual({
      eyelid: "monolid",
      eyeShape: "almond",
      lipShape: "thin",
      faceShape: "oval",
      eyebrowShape: "straight",
    });
    expect(normalizeFaceAttributes(double.data.results as FaceAttrResults).profile).toEqual({
      eyelid: "double",
      eyeShape: "round",
      lipShape: "full",
      faceShape: "round",
      eyebrowShape: "soft_angled",
    });
  });

  it("maps eyelid edge cases: asymmetric single/double → inner_double, Deep-Set → hooded", () => {
    expect(mapEyelid("Single-lid", "Double-lid")).toBe("inner_double");
    expect(mapEyelid("Deep-Set", "Deep-Set")).toBe("hooded");
    expect(mapEyelid("Hooded-lid", "Double-lid")).toBe("hooded");
    expect(mapEyelid(undefined, undefined)).toBe("double");
    expect(mapLipShape(["Bow", "Thin"])).toBe("thin");
    expect(mapLipShape(["Wide"])).toBe("average");
    expect(mapFaceShape("InvTriangle")).toBe("heart");
    expect(mapFaceShape("Unknown")).toBe("oval");
    expect(mapBrowShape("Obscured", "Rounded")).toBe("rounded");
  });
});

describe("analyzeFace service (mock transport)", () => {
  it("uploads (file + PUT), runs one 10u task, caches the file id by image hash, recommends a lesson", async () => {
    const t = createMockTransport({ render: async (s) => s });
    const rt = createRuntime(readConfig({}), t);
    const img = await syntheticSelfie();
    const r = await analyzeFace(rt, "s1", img, fast);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("mock");
    expect(r.profile.eyelid).toBe("monolid");
    expect(r.recommendation.lessonId).toBe("daily-k");
    expect(r.units).toMatchObject({ spent: 10, sessionSpent: 10, sessionCap: 20, remaining: 990 });
    expect(t.calls).toMatchObject({ createFile: 1, put: 1, runTask: { "face-attr-analysis": 1 } });
    const clean = (await sanitizeImage(img)).bytes;
    expect(rt.fileIds.get(sha256(clean))).toMatch(/^mock-file-/);
  });

  it("maps an engine error to retake guidance and does not charge", async () => {
    const rt = rtWith({ failFeature: { "face-attr-analysis": "error_face_position_too_small" } });
    const r = await analyzeFace(rt, "s", await syntheticSelfie(), fast);
    expect(r).toMatchObject({ ok: false, status: 422, code: "error_face_position_too_small", guide: "face_too_small" });
    expect((await rt.guard.status("s")).sessionSpent).toBe(0);
  });

  it("plays back the sample model (0u) when the balance is under 150", async () => {
    const t = createMockTransport({ credit: 100 });
    const rt = createRuntime(readConfig({}), t);
    const r = await analyzeFace(rt, "s", await syntheticSelfie(), fast);
    expect(r).toMatchObject({ ok: true, mode: "demo", units: { spent: 0 } });
    expect(t.calls.createFile).toBe(0);
  });

  it("stops at the session cap", async () => {
    const rt = rtWith({}, { SESSION_UNIT_CAP: "15" });
    const img = await syntheticSelfie();
    expect((await analyzeFace(rt, "s", img, fast)).ok).toBe(true);
    expect(await analyzeFace(rt, "s", img, fast)).toMatchObject({ ok: false, status: 429, code: "session_cap", guide: "credit" });
  });

  it("rejects undecodable uploads before spending units", async () => {
    const rt = rtWith();
    expect(await analyzeFace(rt, "s", new Uint8Array([1, 2, 3]), fast)).toMatchObject({ ok: false, status: 400, code: "undecodable" });
    expect((await rt.guard.status("s")).sessionSpent).toBe(0);
  });
});

describe("POST /api/analyze", () => {
  it("accepts multipart image and returns the profile JSON without any URL", async () => {
    setRuntime(rtWith({ runningPolls: 0 }));
    const form = new FormData();
    form.set("image", new Blob([await syntheticSelfie()], { type: "image/jpeg" }), "selfie.jpg");
    const res = await POST(new Request("http://x/api/analyze", { method: "POST", body: form }));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toMatch(/mock:\/\/|https?:\/\//);
    expect(JSON.parse(text)).toMatchObject({ ok: true, profile: { eyelid: "monolid" } });
  });

  it("400 when no image is sent", async () => {
    setRuntime(rtWith());
    const res = await POST(new Request("http://x/api/analyze", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });
});
