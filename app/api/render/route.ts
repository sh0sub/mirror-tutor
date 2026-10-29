import { getRuntime } from "@/lib/runtime";
import { ensureSession } from "@/lib/session";
import { renderLesson } from "@/lib/services/render";
import { getLesson, parseStepScales } from "@/lib/lessons";
import { isFaceProfile } from "@/lib/profile";
import { MAX_UPLOAD_BYTES } from "@/lib/privacy/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/render (multipart: image, lessonId, profile JSON, optional steps "1,3", optional stepScales JSON {"2":1.2})
 * → NDJSON stream: one {"type":"step",...} line per finished step, then {"type":"done",...}.
 */
export async function POST(req: Request) {
  const session = ensureSession(req);
  const bad = (code: string) => Response.json({ ok: false, code }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("bad_form");
  }
  const file = form.get("image");
  const lessonId = String(form.get("lessonId") ?? "");
  let profile: unknown;
  try {
    profile = JSON.parse(String(form.get("profile") ?? "null"));
  } catch {
    profile = null;
  }
  const steps = String(form.get("steps") ?? "")
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  let stepScales: unknown = null;
  try {
    stepScales = JSON.parse(String(form.get("stepScales") ?? "null"));
  } catch {
    stepScales = null;
  }
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) return bad("missing_image");
  if (!getLesson(lessonId)) return bad("unknown_lesson");
  if (!isFaceProfile(profile)) return bad("bad_profile");
  // S4: per-step intensity (0.8/1.2). Re-rendering one step goes through the same cache key and session guard.
  const build = { stepScales: parseStepScales(stepScales, getLesson(lessonId)!.steps.length) };

  const image = new Uint8Array(await file.arrayBuffer());
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const summary = await renderLesson(getRuntime(), session.id, { image, lessonId, profile: profile as never, steps, build }, (r) =>
          send({ type: "step", ...r }),
        );
        send({ type: "done", ...summary });
      } catch {
        send({ type: "fatal", code: "internal" });
      } finally {
        controller.close();
      }
    },
  });
  const headers = new Headers({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
  if (session.setCookie) headers.append("Set-Cookie", session.setCookie);
  return new Response(stream, { headers });
}
