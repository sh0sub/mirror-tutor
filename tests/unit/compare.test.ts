import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { comparePair, compareStep, eyelidStep, sameEyelid, type CompareManifest } from "@/lib/demo/compare";
import { FACE_NAME } from "@/lib/labels";
import { buildLesson } from "@/lib/lessons";
import manifestJson from "@/public/demo/compare.json";

const manifest = manifestJson as CompareManifest;
const pub = (p: string) => path.join(process.cwd(), "public", p);

describe("S2 two-face compare (#18)", () => {
  it("manifest: 3 models, same lesson, every step pre-generated as a 600×800 JPEG without EXIF/ICC", async () => {
    expect(manifest.models.map((m) => m.id)).toEqual(["model-a", "model-b", "model-c"]);
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
      expect(m.credit).toMatch(/(Pexels|Unsplash) License/);
    }
  });

  it("/compare shows a real monolid face next to the double-lid face, and their eyelid branches differ", () => {
    const [a, b] = comparePair(manifest);
    expect([a.id, b.id]).toEqual(["model-c", "model-a"]);
    expect([a.profile.eyelid, b.profile.eyelid]).toEqual(["monolid", "double"]);
    expect([FACE_NAME[a.profile.eyelid].en, FACE_NAME[b.profile.eyelid].ko]).toEqual(["Monolid face", "쌍꺼풀 얼굴"]);
    expect(sameEyelid(manifest)).toBe(false);
    const k = eyelidStep(manifest.lessonId, a.profile, b.profile);
    expect(k).toBe(3);
    const eye = compareStep(manifest.lessonId, a.profile, b.profile, k!, "en").find((r) => r.attr === "eyelid");
    expect(eye).toBeDefined();
    expect(eye!.same).toBe(false);
    expect(eye!.values).toEqual(["Monolid", "Double lid"]);
    expect(eye!.patterns[0]).not.toBe(eye!.patterns[1]);
  });

  it("the monolid face is an honest M2 correction: the analyzer's raw reading is kept and the field is marked edited", () => {
    const c = manifest.models.find((m) => m.id === "model-c")!;
    expect(c.edited).toEqual(["eyelid"]);
    expect(c.source.eyelid).toBe("Double-lid / Double-lid");
    for (const m of manifest.models.filter((x) => x.id !== "model-c")) expect(m.edited).toBeUndefined();
  });

  it("comparePair falls back to the first two models when there is no monolid/double pair", () => {
    const noMono = { ...manifest, models: manifest.models.filter((m) => m.profile.eyelid !== "monolid") };
    expect(comparePair(noMono).map((m) => m.id)).toEqual(["model-a", "model-b"]);
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

  it("what-if (hooded + thin lips vs the double-lid face) shows visible technique differences on the eye and lip steps", () => {
    const a = comparePair(manifest)[1].profile;
    const what = { ...a, eyelid: "hooded", lipShape: "thin" } as const;
    const eye = compareStep(manifest.lessonId, a, what, 3, "ko").find((r) => r.attr === "eyelid");
    expect(eye?.same).toBe(false);
    const lip = compareStep(manifest.lessonId, a, what, 4, "ko").find((r) => r.attr === "lipShape");
    expect(lip?.same).toBe(false);
  });
});
