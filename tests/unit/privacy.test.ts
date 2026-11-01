import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { sanitizeImage, ImageRejectedError } from "@/lib/privacy/sanitize";
import { redact, safeLog } from "@/lib/privacy/log";
import { PROFILE_STORAGE_KEY, clearProfile, loadProfile, saveProfile, serializeProfile } from "@/lib/privacy/profileStore";
import type { StoredProfile } from "@/lib/profile";
import { analyzeFace } from "@/lib/services/analyze";
import { createRuntime } from "@/lib/runtime";
import { readConfig } from "@/lib/config";
import { createMockTransport } from "@/lib/youcam/mock";
import { syntheticSelfie } from "../helpers";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

const stored: StoredProfile = {
  profile: { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" },
  edited: ["lipShape"],
  source: { eyelid: "Single-lid / Single-lid" },
};

describe("② EXIF removal + size limits", () => {
  it("strips EXIF/GPS and bakes orientation, long side ≤ 1600", async () => {
    const withExif = await sharp(await syntheticSelfie({ width: 1500, height: 2000 }))
      .withExif({ IFD0: { Make: "PhoneMaker", Model: "X1", Copyright: "someone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 33/1 0/1" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await sanitizeImage(new Uint8Array(withExif));
    const meta = await sharp(out.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(Buffer.from(out.bytes).includes(Buffer.from("PhoneMaker"))).toBe(false);
  });

  it("rejects oversized, tiny and non-image uploads", async () => {
    await expect(sanitizeImage(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toMatchObject({ code: "too_large" });
    const tiny = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    await expect(sanitizeImage(new Uint8Array(tiny))).rejects.toMatchObject({ code: "too_small" });
    await expect(sanitizeImage(new TextEncoder().encode("hello"))).rejects.toBeInstanceOf(ImageRejectedError);
  });
});

describe("① logs never contain images, URLs, ids or keys", () => {
  it("redacts data URLs, URLs, bearer keys and long ids", () => {
    const line = redact(
      "fail https://s3.example/x?token=abc data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ Bearer sk-live-123 grH0CvsgXuAIHLUzD0V1Ol34hoet3R1tvdbtiVHrDb6",
    );
    expect(line).toBe("fail [url] [image] Bearer [key] [id]");
    expect(safeLog("warn", new Uint8Array(5000))).toBe("[bytes 5000]");
  });

  it("the analyze flow writes nothing identifying to the console", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rt = createRuntime(readConfig({}), createMockTransport({ failFeature: { "face-attr-analysis": "error_no_face" } }));
    await analyzeFace(rt, "s", await syntheticSelfie(), { sleep: async () => {} });
    for (const call of spy.mock.calls) expect(String(call.join(" "))).not.toMatch(/mock:\/\/|base64|mock-file-/);
    spy.mockRestore();
  });
});

describe("⑤ localStorage keeps attributes only, with a delete", () => {
  it("serializes only the 5 attributes, edited flags and sanitized raw labels", () => {
    const evil = { ...stored, image: "data:image/jpeg;base64,AAAA", source: { eyelid: "https://x.y/<script>" } } as unknown as StoredProfile;
    const json = serializeProfile(evil);
    expect(json).not.toMatch(/data:|https?:|<script>/);
    expect(Object.keys(JSON.parse(json))).toEqual(["profile", "edited", "source"]);
  });

  it("save → load → clear round-trip; garbage is ignored", () => {
    const s = memoryStorage();
    saveProfile(s, stored);
    expect(loadProfile(s)).toMatchObject({ profile: stored.profile, edited: ["lipShape"] });
    clearProfile(s);
    expect(loadProfile(s)).toBeNull();
    s.setItem(PROFILE_STORAGE_KEY, '{"profile":{"eyelid":"nope"}}');
    expect(loadProfile(s)).toBeNull();
  });

  it("survives a storage that throws (private mode)", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
    expect(() => saveProfile(broken, stored)).not.toThrow();
    expect(loadProfile(broken)).toBeNull();
  });
});

describe("⑧ no keys or face images in tracked paths", () => {
  const root = path.resolve(__dirname, "../..");
  const skip = new Set(["node_modules", ".next", ".git", ".local", "coverage"]);
  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) yield* walk(p);
      else yield p;
    }
  }

  it("has .env.example with empty values and .gitignore covering .env and .local/", () => {
    const example = readFileSync(path.join(root, ".env.example"), "utf8");
    for (const line of example.split("\n").filter((l) => /^[A-Z_]+_KEY=/.test(l))) expect(line).toMatch(/=$/);
    const gi = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gi).toMatch(/^\.env$/m);
    expect(gi).toMatch(/^\.local\/$/m);
  });

  it("contains no raster photos (except the licensed S2 demo set) and no key-shaped secrets", () => {
    // S2 (#18): only the stock-photo files listed in public/demo/compare.json are allowed (EXIF-free, checked in compare.test.ts).
    const manifest = JSON.parse(readFileSync(path.join(root, "public/demo/compare.json"), "utf8")) as { models: Array<{ original: string; steps: string[]; gradientPair?: { horizontal: string; vertical: string } }> };
    const allowed = new Set(manifest.models.flatMap((m) => [m.original, ...m.steps, ...(m.gradientPair ? [m.gradientPair.horizontal, m.gradientPair.vertical] : [])].map((p) => path.join("public", p))));
    for (const f of walk(root)) {
      const rel = path.relative(root, f);
      expect(/\.(jpe?g|png|heic|webp)$/i.test(rel) && !rel.startsWith("app/") && !allowed.has(rel) ? rel : "").toBe("");
      if (/\.(ts|tsx|json|md|mjs|env\.example)$/.test(rel) && statSync(f).size < 2_000_000) {
        const text = readFileSync(f, "utf8");
        expect(/sk-ant-[A-Za-z0-9-]{10,}/.test(text) ? rel : "").toBe("");
      }
    }
  });
});
