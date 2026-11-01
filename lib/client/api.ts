"use client";

import type { AnalyzeResult } from "../services/analyze";
import type { RenderSummary, StepResult } from "../services/render";
import type { GradeResult } from "../grade/types";
import type { LandmarkMeasure } from "../grade/landmarks";
import type { FaceProfile } from "../profile";
import type { FaceAnchors } from "../regions";

export interface CreditInfo {
  mode: "mock" | "live";
  demo: boolean;
  remaining: number | null;
  sessionSpent: number;
  sessionCap: number;
}

export async function fetchCredit(): Promise<CreditInfo | null> {
  try {
    const res = await fetch("/api/credit", { cache: "no-store" });
    return res.ok ? ((await res.json()) as CreditInfo) : null;
  } catch {
    return null;
  }
}

/** image null → the sample model (server plays back Model A's pre-generated profile, 0 units, no upload). */
export async function postAnalyze(image: Blob | null): Promise<AnalyzeResult> {
  const form = new FormData();
  if (image) form.set("image", image, "selfie.jpg");
  else form.set("sample", "1");
  try {
    const res = await fetch("/api/analyze", { method: "POST", body: form });
    return (await res.json()) as AnalyzeResult;
  } catch {
    return { ok: false, status: 0, code: "network", guide: "retry", demoAvailable: false };
  }
}

export type RenderEvent = ({ type: "step" } & StepResult) | ({ type: "done" } & RenderSummary) | { type: "fatal"; code: string };

/** Reads the NDJSON stream from /api/render, calling onEvent as each step finishes. */
/** image null → the sample model (pre-generated steps, 0 units; nothing is uploaded). */
export async function streamRender(
  image: Blob | null,
  lessonId: string,
  profile: FaceProfile,
  onEvent: (e: RenderEvent) => void,
  steps?: number[],
  stepScales?: Record<number, number>,
  anchors?: FaceAnchors | null,
  skinShade?: string | null,
): Promise<void> {
  const form = new FormData();
  if (image) form.set("image", image, "selfie.jpg");
  else form.set("sample", "1");
  form.set("lessonId", lessonId);
  form.set("profile", JSON.stringify(profile));
  if (steps?.length) form.set("steps", steps.join(","));
  if (stepScales && Object.keys(stepScales).length) form.set("stepScales", JSON.stringify(stepScales));
  if (anchors) form.set("anchors", JSON.stringify(anchors));
  if (skinShade) form.set("skinShade", skinShade); // ladder id only, never the measured color
  const res = await fetch("/api/render", { method: "POST", body: form });
  if (!res.ok || !res.body) {
    onEvent({ type: "fatal", code: `http_${res.status}` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as RenderEvent);
    }
  }
}

export async function postGrade(answer: Blob, attempt: Blob, landmarks?: LandmarkMeasure | null): Promise<GradeResult | { error: string }> {
  const form = new FormData();
  form.set("answer", answer, "answer.jpg");
  form.set("attempt", attempt, "attempt.jpg");
  if (landmarks) form.set("landmarks", JSON.stringify(landmarks)); // numbers only (S1)
  try {
    const res = await fetch("/api/grade", { method: "POST", body: form });
    return (await res.json()) as GradeResult | { error: string };
  } catch {
    return { error: "network" };
  }
}

export async function postEndSession(): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE" });
  } catch {
    /* best effort */
  }
}
