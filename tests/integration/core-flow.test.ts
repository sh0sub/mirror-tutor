import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { checkQuality } from "@/lib/quality/gate";
import { buildLesson } from "@/lib/lessons";
import { matchStepEffects } from "@/lib/shop";
import { drawShareCard, type CardContext } from "@/lib/share/card";
import { mockRenderEffects } from "@/lib/youcam/mockRender";
import { POST as analyze } from "@/app/api/analyze/route";
import { POST as renderRoute } from "@/app/api/render/route";
import { POST as gradeRoute } from "@/app/api/grade/route";
import { GET as credit } from "@/app/api/credit/route";
import { DELETE as endSession } from "@/app/api/session/route";
import { syntheticSelfie } from "../helpers";

afterEach(() => setRuntime(undefined));

const blob = (b: Uint8Array) => new Blob([Buffer.from(b)], { type: "image/jpeg" });

/**
 * Flow A end to end in mock mode (no API key, no units): capture guide → Face Analyzer → lesson
 * render (4 cumulative VTO steps) → grading → Shop the step → share card → session end.
 */
describe("core flow (mock mode)", () => {
  it("capture → analyze → lesson → grade → shop → share, spending exactly 14 units", async () => {
    const transport = createMockTransport({ runningPolls: 1 });
    const rt = createRuntime(readConfig({ YOUCAM_MODE: "mock" }), transport);
    setRuntime(rt);

    // M1: quality gate on the captured frame — a far-away selfie fails, the retake passes
    const far = await syntheticSelfie({ faceWidth: 0.4 });
    const raw = async (img: Uint8Array) => {
      const { data, info } = await sharp(img).resize({ width: 240 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data: new Uint8Array(data) };
    };
    expect(checkQuality(await raw(far)).issues).toContain("face_too_small");
    const selfie = await syntheticSelfie();
    expect(checkQuality(await raw(selfie)).pass).toBe(true);

    // M2: analyze (10u) — session cookie issued here and reused for the rest of the flow
    const f1 = new FormData();
    f1.set("image", blob(selfie));
    const aRes = await analyze(new Request("http://x/api/analyze", { method: "POST", body: f1 }));
    const cookie = aRes.headers.get("set-cookie")!.split(";")[0];
    const a = await aRes.json();
    expect(a).toMatchObject({ ok: true, mode: "mock", profile: { eyelid: "monolid", lipShape: "thin" }, recommendation: { lessonId: "daily-k" } });

    // user corrects one attribute on M2 (0u, re-branch only)
    const profile = { ...a.profile, eyeShape: "round" };
    const plan = buildLesson(a.recommendation.lessonId, profile);
    expect(plan.steps[2].effects[1].pattern?.name).toBe("OpenWings1");

    // M3: render all 4 steps (4u), streamed
    const f2 = new FormData();
    f2.set("image", blob(selfie));
    f2.set("lessonId", plan.id);
    f2.set("profile", JSON.stringify(profile));
    const rRes = await renderRoute(new Request("http://x/api/render", { method: "POST", body: f2, headers: { cookie } }));
    const lines = (await rRes.text()).trim().split("\n").map((l) => JSON.parse(l));
    const steps = lines.filter((l) => l.type === "step");
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "done", "done"]);
    expect(lines.at(-1)).toMatchObject({ type: "done", spent: 4, units: { sessionSpent: 14 } });
    expect(transport.calls.createFile).toBe(1); // render reused the analyze upload
    const answer = new Uint8Array(Buffer.from(steps.find((s) => s.index === 4).image.split(",")[1], "base64"));

    // M4: grade my attempt against step 4 (0u). Attempt = the same look drawn a bit lighter.
    const attempt = await mockRenderEffects(
      selfie,
      plan.steps[3].cumulativeEffects.map((e) => ({ ...e, palettes: e.palettes?.map((p) => ({ ...p, colorIntensity: Math.round((p.colorIntensity ?? 50) * 0.7) })) })),
    );
    const f3 = new FormData();
    f3.set("answer", blob(answer));
    f3.set("attempt", blob(attempt));
    const g = await (await gradeRoute(new Request("http://x/api/grade", { method: "POST", body: f3 }))).json();
    expect(g).toMatchObject({ comparable: true, grader: "local", units: 0 });
    expect(g.total).toBeGreaterThan(60);
    expect(g.total).toBeLessThan(100);
    expect(g.regions).toHaveLength(4);

    // M6: Shop the step — every step color maps to a product or an explicit "no close match"
    for (const s of plan.steps) {
      for (const m of matchStepEffects(s.effects)) expect(m.matches.length > 0 || m.category === "foundation" || m.category === "contour").toBe(true);
    }
    expect(matchStepEffects(plan.steps[2].effects)[0].matches[0].product.sku).toBe("MT-SD-03");

    // M7: share card drawn locally with the graded score
    const texts: string[] = [];
    const ctx = {
      fillStyle: "", filter: "none", font: "", textAlign: "left",
      fillRect() {}, drawImage() {}, save() {}, restore() {}, scale() {},
      fillText: (s: string) => texts.push(s),
    } as unknown as CardContext;
    const img = { width: 1200, height: 1600 };
    drawShareCard(ctx, [img, img, img], {
      lessonTitle: plan.title.ko, variant: "홑꺼풀 버전", score: g.total, blurFaces: true, hideScore: false,
      labels: { original: "원본", answer: "정답", attempt: "내 시도", scoreUnit: "점", footer: "Mirror Tutor" },
    });
    expect(texts).toContain(String(g.total));

    // units: exactly one full flow (14u) charged; balance reflects it
    expect(transport.charged).toBe(14);
    expect(await (await credit(new Request("http://x/api/credit", { headers: { cookie } }))).json()).toMatchObject({ sessionSpent: 14, remaining: 986 });

    // F9: ending the session purges cached renders
    const end = await (await endSession(new Request("http://x/api/session", { method: "DELETE", headers: { cookie } }))).json();
    expect(end).toEqual({ ok: true, purged: 4 });
  });

  it("flow B (returning user): profile from the device, new selfie, render only (4u, no Face Analyzer)", async () => {
    const transport = createMockTransport({ render: async (s) => s });
    setRuntime(createRuntime(readConfig({}), transport));
    const profile = { eyelid: "double", eyeShape: "almond", lipShape: "thin", faceShape: "round", eyebrowShape: "soft_angled" };
    const f = new FormData();
    f.set("image", blob(await syntheticSelfie()));
    f.set("lessonId", "gradient-lip");
    f.set("profile", JSON.stringify(profile));
    const lines = (await (await renderRoute(new Request("http://x/api/render", { method: "POST", body: f }))).text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ type: "done", spent: 4 });
    expect(transport.calls.runTask["face-attr-analysis"]).toBeUndefined();
  });

  it("demo mode (<150u): the whole flow plays back the sample model and charges nothing", async () => {
    const transport = createMockTransport({ credit: 140 });
    setRuntime(createRuntime(readConfig({}), transport));
    const f1 = new FormData();
    f1.set("image", blob(await syntheticSelfie()));
    const a = await (await analyze(new Request("http://x/api/analyze", { method: "POST", body: f1 }))).json();
    expect(a).toMatchObject({ ok: true, mode: "demo" });
    const f2 = new FormData();
    f2.set("image", blob(await syntheticSelfie()));
    f2.set("lessonId", "daily-k");
    f2.set("profile", JSON.stringify(a.profile));
    const lines = (await (await renderRoute(new Request("http://x/api/render", { method: "POST", body: f2 }))).text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === "step" && l.status === "done")).toHaveLength(4);
    expect(lines.at(-1)).toMatchObject({ mode: "demo", spent: 0 });
    expect(transport.charged).toBe(0);
  });
});
