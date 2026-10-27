import { afterEach, describe, expect, it } from "vitest";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { analyzeFace } from "@/lib/services/analyze";
import { renderLesson } from "@/lib/services/render";
import { DELETE } from "@/app/api/session/route";
import { syntheticSelfie } from "../helpers";

const fast = { sleep: async () => {} };
const profile = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" } as const;
afterEach(() => setRuntime(undefined));

describe("F9 session end", () => {
  it("DELETE /api/session purges that session's cached renders and file ids, and clears the cookie", async () => {
    const rt = createRuntime(readConfig({}), createMockTransport({ render: async (s) => s }));
    setRuntime(rt);
    const sid = "11111111-2222-3333-4444-555555555555";
    const img = await syntheticSelfie();
    await analyzeFace(rt, sid, img, fast);
    await renderLesson(rt, sid, { image: img, lessonId: "daily-k", profile }, () => {}, fast);
    expect(rt.renderCache.size).toBe(4);
    expect(rt.fileIds.size).toBe(1);

    const res = await DELETE(new Request("http://x/api/session", { method: "DELETE", headers: { cookie: `mt_sid=${sid}` } }));
    expect(await res.json()).toEqual({ ok: true, purged: 4 });
    expect(rt.renderCache.size).toBe(0);
    expect(rt.fileIds.size).toBe(0);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("does not touch other sessions", async () => {
    const rt = createRuntime(readConfig({}), createMockTransport({ render: async (s) => s }));
    setRuntime(rt);
    await renderLesson(rt, "other", { image: await syntheticSelfie({ faceWidth: 0.7 }), lessonId: "daily-k", profile }, () => {}, fast);
    await DELETE(new Request("http://x/api/session", { method: "DELETE", headers: { cookie: "mt_sid=11111111-2222-3333-4444-555555555555" } }));
    expect(rt.renderCache.size).toBe(4);
  });
});
