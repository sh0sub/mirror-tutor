"use client";

import { checkQuality, targetSize, type QualityResult } from "../quality/gate";

/** Browser-side capture helpers (F1). Canvas re-encoding also drops EXIF before upload; the server strips again. */

export async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

/** Downscaled pixels for the quality gate (fast enough to run on live video frames). */
export function framePixels(source: CanvasImageSource, w: number, h: number, sampleWidth = 240) {
  const sw = sampleWidth;
  const sh = Math.round((h / w) * sw);
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(source, 0, 0, sw, sh);
  const img = ctx.getImageData(0, 0, sw, sh);
  return { width: sw, height: sh, data: img.data };
}

export function qualityOf(source: CanvasImageSource, w: number, h: number): QualityResult {
  return checkQuality(framePixels(source, w, h));
}

/** Long side 1600, JPEG q0.9 (plan step 1). */
export async function toUploadJpeg(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
  const size = targetSize(w, h);
  const c = document.createElement("canvas");
  c.width = size.width;
  c.height = size.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9));
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith("data:")) return dataUrlToBlob(url);
  const res = await fetch(url);
  return res.blob();
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
