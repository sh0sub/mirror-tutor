import { randomUUID } from "node:crypto";

/** Anonymous session cookie used only to count units per session (F8). No personal data. */
export const SESSION_COOKIE = "mt_sid";
const ID = /^[0-9a-f-]{36}$/;

export function readSessionId(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m && ID.test(m[1]) ? m[1] : null;
}

/** Returns the session id and, when new, the Set-Cookie header value to attach. */
export function ensureSession(req: Request): { id: string; setCookie?: string } {
  const existing = readSessionId(req);
  if (existing) return { id: existing };
  const id = randomUUID();
  return { id, setCookie: `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` };
}

export function withSession(res: Response, setCookie?: string): Response {
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}
