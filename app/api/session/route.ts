import { endSession, getRuntime } from "@/lib/runtime";
import { readSessionId, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/session — F9 "세션 폐기": purge this session's cached renders and counters, clear the cookie. */
export async function DELETE(req: Request) {
  const id = readSessionId(req);
  const purged = id ? endSession(getRuntime(), id) : 0;
  const res = Response.json({ ok: true, purged });
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
