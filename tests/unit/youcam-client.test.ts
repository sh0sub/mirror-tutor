import { describe, expect, it, vi } from "vitest";
import { createHttpTransport, totalCredit, YouCamHttpError } from "@/lib/youcam/client";
import { uploadImage } from "@/lib/youcam/file";
import { pollTask, YouCamTaskError, YouCamTimeoutError } from "@/lib/youcam/poll";
import { createMockTransport } from "@/lib/youcam/mock";
import fileSpec from "@/fixtures/youcam/file.spec.json";
import creditSpec from "@/fixtures/youcam/credit.spec.json";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("HTTP transport", () => {
  it("sends Bearer auth and the documented file → PUT flow", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/s2s/v2.0/file")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
        expect(JSON.parse(String(init?.body))).toEqual({
          files: [{ content_type: "image/jpeg", file_name: "selfie.jpg", file_size: 3 }],
        });
        return jsonResponse({
          ...fileSpec,
          data: { files: [{ ...fileSpec.data.files[0], requests: [{ url: "https://upload.example/presigned", method: "PUT", headers: { "Content-Type": "image/jpeg" } }] }] },
        });
      }
      if (u === "https://upload.example/presigned") {
        expect(init?.method).toBe("PUT");
        // The API key must never be sent to the presigned storage URL.
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
        return new Response(null, { status: 200 });
      }
      throw new Error(`unexpected ${u}`);
    });
    const t = createHttpTransport({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    const id = await uploadImage(t, new Uint8Array([1, 2, 3]));
    expect(id).toBe("mock-file-id");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps 400 error bodies to YouCamHttpError with the error_code, without leaking URLs", async () => {
    const t = createHttpTransport({
      apiKey: "k",
      fetchImpl: (async () => jsonResponse({ status: 400, error_code: "CreditInsufficiency" }, 400)) as unknown as typeof fetch,
    });
    const err = await t.runTask("makeup-vto", {}).catch((e) => e);
    expect(err).toBeInstanceOf(YouCamHttpError);
    expect(err.code).toBe("CreditInsufficiency");
    expect(err.message).not.toMatch(/https?:/);
  });

  it("refuses to build a live transport without a key", () => {
    expect(() => createHttpTransport({ apiKey: "" })).toThrow();
  });

  it("totalCredit sums amount_dec across buckets", () => {
    expect(totalCredit(creditSpec)).toBe(1000);
    expect(totalCredit({ status: 200, results: [{ id: 1, type: "a", amount: 3 }, { id: 2, type: "b", amount_dec: 2.5 }] })).toBe(5.5);
  });
});

describe("pollTask", () => {
  it("polls every 1.5s until success and fires onSlow after 15s", async () => {
    let now = 0;
    const statuses = Array(11).fill({ task_status: "running" }).concat([{ task_status: "success", results: { ok: 1 } }]);
    const transport = { getTask: vi.fn(async () => ({ status: 200, data: statuses.shift() })) } as never;
    const onSlow = vi.fn();
    const r = await pollTask(transport, "face-attr-analysis", "t", {
      sleep: async (ms) => void (now += ms),
      now: () => now,
      onSlow,
    });
    expect(r).toEqual({ ok: 1 });
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(now).toBe(11 * 1500);
  });

  it("throws YouCamTaskError with the engine code on error", async () => {
    const transport = { getTask: async () => ({ status: 200, data: { task_status: "error", error: "error_face_position_too_small" } }) } as never;
    await expect(pollTask(transport, "face-attr-analysis", "t")).rejects.toMatchObject({ code: "error_face_position_too_small" });
    await expect(pollTask(transport, "face-attr-analysis", "t")).rejects.toBeInstanceOf(YouCamTaskError);
  });

  it("gives up after 30s", async () => {
    let now = 0;
    const transport = { getTask: async () => ({ status: 200, data: { task_status: "running" } }) } as never;
    await expect(
      pollTask(transport, "makeup-vto", "t", { sleep: async (ms) => void (now += ms), now: () => now }),
    ).rejects.toBeInstanceOf(YouCamTimeoutError);
    expect(now).toBeLessThanOrEqual(30_000);
  });
});

describe("mock transport", () => {
  it("rejects a task on a file that was never PUT (same failure as the live API)", async () => {
    const t = createMockTransport();
    const f = await t.createFile({ files: [{ content_type: "image/jpeg", file_name: "a.jpg", file_size: 1 }] });
    await expect(t.runTask("face-attr-analysis", { src_file_id: f.data.files[0].file_id })).rejects.toMatchObject({ code: "FileNotUploaded" });
  });

  it("charges only successful tasks", async () => {
    const t = createMockTransport({ failFeature: { "face-attr-analysis": "error_face_position_too_small" }, runningPolls: 0 });
    const id = await uploadImage(t, new Uint8Array([1]));
    const { data } = await t.runTask("face-attr-analysis", { src_file_id: id });
    await expect(pollTask(t, "face-attr-analysis", data.task_id, { sleep: async () => {} })).rejects.toBeInstanceOf(YouCamTaskError);
    expect(t.charged).toBe(0);
  });
});
