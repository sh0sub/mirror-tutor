/**
 * Privacy ① : server logs must never contain images, result URLs, file/task ids or keys.
 * Use `safeLog` instead of console.* in server code; it redacts anything URL-, base64- or key-shaped.
 */
const URL_RE = /\b(?:https?|mock):\/\/[^\s"']+/gi;
const DATA_URL_RE = /data:[^;\s]+;base64,[A-Za-z0-9+/=]+/g;
const LONG_TOKEN_RE = /[A-Za-z0-9+/_=-]{32,}/g;
const BEARER_RE = /Bearer\s+[^\s"']+/gi;

export function redact(input: string): string {
  return input
    .replace(DATA_URL_RE, "[image]")
    .replace(URL_RE, "[url]")
    .replace(BEARER_RE, "Bearer [key]")
    .replace(LONG_TOKEN_RE, "[id]");
}

function fmt(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (v instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(v))) return `[bytes ${v.byteLength}]`;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function safeLog(level: "info" | "warn" | "error", ...parts: unknown[]): string {
  const line = redact(parts.map(fmt).join(" "));
  if (process.env.NODE_ENV !== "test") console[level](`[mirror-tutor] ${line}`);
  return line;
}
