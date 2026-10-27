import { afterEach, describe, expect, it } from "vitest";
import { createRuntime, setRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { GET } from "@/app/api/credit/route";

afterEach(() => setRuntime(undefined));

describe("GET /api/credit", () => {
  it("reports mock mode, balance and session usage, and sets an anonymous session cookie", async () => {
    setRuntime(createRuntime(readConfig({ YOUCAM_MODE: "mock" }), createMockTransport({ credit: 742 })));
    const res = await GET(new Request("http://x/api/credit"));
    expect(await res.json()).toEqual({ mode: "mock", demo: false, remaining: 742, sessionSpent: 0, sessionCap: 20 });
    expect(res.headers.get("set-cookie")).toMatch(/^mt_sid=[0-9a-f-]{36}; Path=\/; HttpOnly/);
  });

  it("flags demo mode below 150 units", async () => {
    setRuntime(createRuntime(readConfig({}), createMockTransport({ credit: 120 })));
    const body = await (await GET(new Request("http://x/api/credit"))).json();
    expect(body.demo).toBe(true);
  });

  it("stays in mock mode unless a key is present and YOUCAM_MODE is not mock", () => {
    expect(readConfig({}).mode).toBe("mock");
    expect(readConfig({ YOUCAM_API_KEY: "k", YOUCAM_MODE: "mock" }).mode).toBe("mock");
    expect(readConfig({ YOUCAM_API_KEY: "k", YOUCAM_MODE: "live" }).mode).toBe("live");
  });
});
