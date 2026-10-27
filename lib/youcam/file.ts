import type { YouCamTransport } from "./client";
import { YouCamHttpError } from "./client";

/**
 * Upload via File API: POST /s2s/v2.0/file → PUT bytes to the presigned URL → file_id.
 * Skipping the PUT makes later tasks fail with 500/404 (docs warning), so both steps are mandatory.
 * The presigned URL is used here and dropped; it is never logged or returned.
 */
export async function uploadImage(
  transport: YouCamTransport,
  bytes: Uint8Array,
  contentType = "image/jpeg",
  fileName = "selfie.jpg",
): Promise<string> {
  const res = await transport.createFile({
    files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }],
  });
  const file = res?.data?.files?.[0];
  const req = file?.requests?.[0];
  if (!file?.file_id || !req?.url) throw new YouCamHttpError(res?.status ?? 0, "MalformedFileResponse", "/s2s/v2.0/file");

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers ?? {})) headers[k] = String(v);
  if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) headers["Content-Type"] = contentType;

  await transport.putUpload(req.url, req.method || "PUT", headers, bytes);
  return file.file_id;
}
