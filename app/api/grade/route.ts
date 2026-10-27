import { getRuntime } from "@/lib/runtime";
import { gradeAttempt, gradeDepsFromEnv } from "@/lib/services/grade";
import { MAX_UPLOAD_BYTES } from "@/lib/privacy/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/grade (multipart: answer, attempt) → GradeResult JSON. Images are processed in memory only. */
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

  const { config } = getRuntime();
  const result = await gradeAttempt(
    new Uint8Array(await answer.arrayBuffer()),
    new Uint8Array(await attempt.arrayBuffer()),
    gradeDepsFromEnv(config.anthropicKey, config.graderModel),
  );
  return Response.json(result, { status: "error" in result ? 400 : 200 });
}
