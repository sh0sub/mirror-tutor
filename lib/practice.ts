/**
 * X4 practice log (local only): which days the user practiced and the best score per lesson.
 * Numbers and dates only — no images, no face data. Cleared with "프로파일 삭제".
 */
export const PRACTICE_STORAGE_KEY = "mirror-tutor:practice:v1";
export const CONSENT_STORAGE_KEY = "mirror-tutor:consent:v1";
const MAX_DAYS = 120;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PracticeLog {
  /** Local calendar days (YYYY-MM-DD), ascending, unique. */
  days: string[];
  /** Best score per lesson id (0-100). */
  scores: Record<string, number>;
}

export const EMPTY_LOG: PracticeLog = { days: [], scores: {} };

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

export function recordPractice(log: PracticeLog, lessonId: string, score: number, now: Date = new Date()): PracticeLog {
  const today = dayKey(now);
  const days = log.days.includes(today) ? log.days : [...log.days, today].sort().slice(-MAX_DAYS);
  const best = Math.max(score, log.scores[lessonId] ?? 0);
  return { days, scores: { ...log.scores, [lessonId]: Math.round(best) } };
}

/** Consecutive practiced days ending today (or yesterday, so the streak survives until the day is over). */
export function streakDays(log: PracticeLog, now: Date = new Date()): number {
  const set = new Set(log.days);
  let cursor = set.has(dayKey(now)) ? now : addDays(now, -1);
  let n = 0;
  while (set.has(dayKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export interface WeekDot {
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  done: boolean;
  today: boolean;
  future: boolean;
}

/** Monday-first dots for the current week. */
export function weekDots(log: PracticeLog, now: Date = new Date()): WeekDot[] {
  const set = new Set(log.days);
  const todayIdx = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i - todayIdx);
    return { weekday: i, done: set.has(dayKey(d)), today: i === todayIdx, future: i > todayIdx };
  });
}

export function loadPractice(storage: StorageLike): PracticeLog {
  try {
    const raw = storage.getItem(PRACTICE_STORAGE_KEY);
    if (!raw) return EMPTY_LOG;
    const v = JSON.parse(raw) as PracticeLog;
    const days = Array.isArray(v.days) ? v.days.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    const scores: Record<string, number> = {};
    for (const [k, s] of Object.entries(v.scores ?? {})) if (typeof s === "number" && s >= 0 && s <= 100) scores[k] = s;
    return { days: Array.from(new Set(days)).sort().slice(-MAX_DAYS), scores };
  } catch {
    return EMPTY_LOG;
  }
}

export function savePractice(storage: StorageLike, log: PracticeLog): void {
  try {
    storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(log));
  } catch {
    /* private mode / quota: the app works without persistence */
  }
}

export function clearPractice(storage: StorageLike): void {
  try {
    storage.removeItem(PRACTICE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** F1: the consent sheet is shown once per device. */
export function loadConsent(storage: StorageLike): boolean {
  try {
    return storage.getItem(CONSENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveConsent(storage: StorageLike, v: boolean): void {
  try {
    if (v) storage.setItem(CONSENT_STORAGE_KEY, "1");
    else storage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* best effort */
  }
}
