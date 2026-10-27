/** Server-side runtime config read from env (.env.example lists the names; values never live in the repo). */

export type ApiMode = "mock" | "live";
type Env = Record<string, string | undefined>;

function int(env: Env, name: string, fallback: number): number {
  const v = Number.parseInt(env[name] ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function readConfig(env: Env = process.env) {
  const apiKey = env.YOUCAM_API_KEY?.trim() || "";
  const requested = env.YOUCAM_MODE?.trim();
  // Live only when explicitly allowed AND a key exists; anything else stays in mock mode (unit protection).
  const mode: ApiMode = apiKey && requested !== "mock" ? "live" : "mock";
  return {
    mode,
    apiKey,
    anthropicKey: env.ANTHROPIC_API_KEY?.trim() || "",
    graderModel: env.GRADER_MODEL?.trim() || "claude-opus-5-5",
    sessionCap: int(env, "SESSION_UNIT_CAP", 20),
    dailyCap: int(env, "DAILY_UNIT_CAP", 120),
    demoThreshold: int(env, "DEMO_MODE_THRESHOLD", 150),
    mockCredit: int(env, "MOCK_CREDIT", 1000),
  };
}

export type AppConfig = ReturnType<typeof readConfig>;
