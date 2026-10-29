import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compareStep, sameEyelid, type CompareManifest } from "@/lib/demo/compare";
import { buildLesson } from "@/lib/lessons";
import manifestJson from "@/public/demo/compare.json";

const manifest = manifestJson as CompareManifest;
const pub = (p: string) => path.join(process.cwd(), "public", p);

describe("S2 two-face compare (#18)", () => {
  it("manifest: 2 models, same lesson, every step pre-generated as a 600×800 JPEG without EXIF/ICC", async () => {
    expect(manifest.models).toHaveLength(2);
    const stepCount = buildLesson(manifest.lessonId, manifest.models[0].profile).steps.length;
    for (const m of manifest.models) {
      expect(m.steps).toHaveLength(stepCount);
      for (const f of [m.original, ...m.steps]) {
        expect(f.startsWith("/demo/")).toBe(true);
        expect(existsSync(pub(f)), f).toBe(true);
        const meta = await sharp(pub(f)).metadata();
        expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 600, 800]);
        expect(meta.exif, `${f} exif`).toBeUndefined();
        expect(meta.icc, `${f} icc`).toBeUndefined();
      }
      expect(m.credit).toMatch(/Pexels/);
    }
  });

  it("the two models take different eyelid branches (no live call needed to show it)", () => {
    expect(sameEyelid(manifest)).toBe(false);
    const [a, b] = manifest.models;
    const eye = compareStep(manifest.lessonId, a.profile, b.profile, 3, "ko").find((r) => r.attr === "eyelid");
    expect(eye).toBeDefined();
    expect(eye!.same).toBe(false);
    expect(eye!.patterns[0]).not.toBe(eye!.patterns[1]);
  });

  it("rows follow the step's rule-table branches and switch language", () => {
    const a = { eyelid: "monolid", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" } as const;
    const b = { eyelid: "double", eyeShape: "almond", lipShape: "thin", faceShape: "oval", eyebrowShape: "straight" } as const;
    expect(compareStep("daily-k", a, b, 1, "ko")).toEqual([]); // base: no profile branch
    const brow = compareStep("daily-k", a, b, 2, "en");
    expect(brow.map((r) => r.attr)).toEqual(["eyebrowShape"]);
    expect(brow[0].same).toBe(true);
    const eyeKo = compareStep("daily-k", a, b, 3, "ko").find((r) => r.attr === "eyelid")!;
    const eyeEn = compareStep("daily-k", a, b, 3, "en").find((r) => r.attr === "eyelid")!;
    expect(eyeKo.values).toEqual(["홑꺼풀", "쌍꺼풀"]);
    expect(eyeEn.values).toEqual(["Monolid", "Double lid"]);
    expect(eyeKo.patterns).toEqual(eyeEn.patterns);
    expect(sameEyelid({ ...manifest, models: manifest.models.map((m) => ({ ...m, profile: { ...m.profile, eyelid: "double" } })) })).toBe(true);
  });
});
