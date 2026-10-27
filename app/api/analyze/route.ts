import { getRuntime } from "@/lib/runtime";
import { ensureSession, withSession } from "@/lib/session";
import { analyzeFace } from "@/lib/services/analyze";
import { MAX_UPLOAD_BYTES } from "@/lib/privacy/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analyze (multipart: image) → normalized face profile.
 * The image is processed in memory and dropped when the request ends (privacy ①); nothing is logged.
 */
export async function POST(req: Request) {
  const session = ensureSession(req);
  let bytes: Uint8Array | null = null;
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (file instanceof Blob && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    bytes = null;
  }
  if (!bytes) {
    return withSession(Response.json({ ok: false, code: "missing_image", guide: "retry", demoAvailable: false }, { status: 400 }), session.setCookie);
  }
  const result = await analyzeFace(getRuntime(), session.id, bytes);
  bytes = null; // release the buffer reference as soon as possible
  return withSession(Response.json(result, { status: result.ok ? 200 : result.status }), session.setCookie);
}
