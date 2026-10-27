import { getRuntime } from "@/lib/runtime";
import { ensureSession, withSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/credit — unit balance for the UI (F8 잔량 표시). Cached 5 min inside the guard. */
export async function GET(req: Request) {
  const { config, guard } = getRuntime();
  const session = ensureSession(req);
  const st = await guard.status(session.id);
  return withSession(
    Response.json({
      mode: config.mode,
      demo: st.demo,
      remaining: st.remaining === null ? null : Math.floor(st.remaining),
      sessionSpent: st.sessionSpent,
      sessionCap: st.sessionCap,
    }),
    session.setCookie,
  );
}
