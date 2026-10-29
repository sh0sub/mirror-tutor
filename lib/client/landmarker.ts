"use client";

import { landmarkMeasure, type LandmarkMeasure, type Pt, type RgbaImage } from "../grade/landmarks";

/**
 * S1 browser side: MediaPipe Face Landmarker (wasm from the jsDelivr CDN, model from Google's model
 * bucket) runs on the answer and attempt images in this tab. Only the 4 regions' Lab means leave the
 * device; landmarks and pixels never do. Any failure (offline, no WebGL/wasm, no face) → null, and
 * /api/grade falls back to the F6 grader.
 */
export const TASKS_VISION_VERSION = "1.1.0"; // keep in sync with package.json
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WORK_WIDTH = 480;

type Landmarker = { detect: (img: HTMLCanvasElement) => { faceLandmarks: Pt[][] } };
let landmarker: Promise<Landmarker> | null = null;

function getLandmarker(): Promise<Landmarker> {
  landmarker ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return (await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 1,
    })) as unknown as Landmarker;
  })().catch((e) => {
    landmarker = null; // allow a later retry
    throw e;
  });
  return landmarker;
}

async function toCanvas(src: Blob | string): Promise<HTMLCanvasElement> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  const bmp = await createImageBitmap(blob);
  const h = Math.round((WORK_WIDTH * bmp.height) / bmp.width);
  const c = document.createElement("canvas");
  c.width = WORK_WIDTH;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, WORK_WIDTH, h);
  bmp.close();
  return c;
}

function pixels(c: HTMLCanvasElement): RgbaImage {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height };
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("landmarker timeout")), ms))]);

/** answer: data URL / object URL of the VTO answer; attempt: the attempt photo blob. */
export async function measureLandmarksInBrowser(answer: Blob | string, attempt: Blob | string, timeoutMs = 12_000): Promise<LandmarkMeasure | null> {
  try {
    return await withTimeout(
      (async () => {
        const [lm, ca, cb] = await Promise.all([getLandmarker(), toCanvas(answer), toCanvas(attempt)]);
        const fa = lm.detect(ca).faceLandmarks[0];
        const fb = lm.detect(cb).faceLandmarks[0];
        if (!fa || !fb) return null;
        return landmarkMeasure(pixels(ca), fa, pixels(cb), fb);
      })(),
      timeoutMs,
    );
  } catch {
    return null;
  }
}
