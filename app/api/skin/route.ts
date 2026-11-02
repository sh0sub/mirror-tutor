import { getRuntime } from "@/lib/runtime";
import { ensureSession, withSession } from "@/lib/session";
import { analyzeSkin, skinSample } from "@/lib/services/skin";
import { DEFAULT_SAMPLE, isSampleId } from "@/lib/services/sample";
import { MAX_UPLOAD_BYTES } from "@/lib/privacy/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/skin (multipart: image) -> opt-in Skin check (YouCam Skin Analysis SD, 4 concerns, 9u).
 * `sample=1` (no image) replays the sample face's pre-generated result: it never touches the YouCam transport or unit guard (0u).
 */
export async function POST(req: Request) {
  const session = ensureSession(req);
  let bytes: Uint8Array | null = null;
  try {
    const form = await req.formData();
    if (form.get("sample") === "1") {
      const which = form.get("sampleId");
      return withSession(Response.json(skinSample(getRuntime().config.sessionCap, isSampleId(which) ? which : DEFAULT_SAMPLE)), session.setCookie);
    }
    const file = form.get("image");
    if (file instanceof Blob && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    bytes = null;
  }
  if (!bytes) {
    return withSession(Response.json({ ok: false, code: "missing_image", guide: "retry", demoAvailable: false }, { status: 400 }), session.setCookie);
  }
  const result = await analyzeSkin(getRuntime(), session.id, bytes);
  bytes = null;
  return withSession(Response.json(result, { status: result.ok ? 200 : result.status }), session.setCookie);
}
