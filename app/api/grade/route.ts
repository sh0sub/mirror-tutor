import { getRuntime } from "@/lib/runtime";
import { gradeAttempt, gradeDepsFromEnv } from "@/lib/services/grade";
import { MAX_UPLOAD_BYTES } from "@/lib/privacy/sanitize";
import { parseLandmarkMeasure } from "@/lib/grade/landmarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/grade (multipart: answer, attempt, optional landmarks = S1 LandmarkMeasure JSON measured in the browser)
 * → GradeResult JSON. Images are processed in memory only. Invalid/absent landmarks → F6 grader (fallback).
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }
  const answer = form.get("answer");
  const attempt = form.get("attempt");
  const ok = (b: unknown): b is Blob => b instanceof Blob && b.size > 0 && b.size <= MAX_UPLOAD_BYTES;
  if (!ok(answer) || !ok(attempt)) return Response.json({ error: "missing_image" }, { status: 400 });

  let landmarks = null;
  try {
    landmarks = parseLandmarkMeasure(JSON.parse(String(form.get("landmarks") ?? "null")));
  } catch {
    landmarks = null;
  }
  const { config } = getRuntime();
  const result = await gradeAttempt(
    new Uint8Array(await answer.arrayBuffer()),
    new Uint8Array(await attempt.arrayBuffer()),
    gradeDepsFromEnv(config.anthropicKey, config.graderModel),
    landmarks,
  );
  return Response.json(result, { status: "error" in result ? 400 : 200 });
}
