import { PROFILE_KEYS, isFaceProfile, type FaceProfile, type ProfileKey, type StoredProfile } from "../profile";

/**
 * Privacy ⑤: localStorage keeps ONLY the 5 normalized attributes (+ which ones the user edited and
 * the raw labels). Never images, never URLs, never scores. "프로파일 삭제" calls `clearProfile`.
 */
export const PROFILE_STORAGE_KEY = "mirror-tutor:profile:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const SOURCE_MAX = 40;

export function serializeProfile(p: StoredProfile): string {
  const profile = Object.fromEntries(PROFILE_KEYS.map((k) => [k, p.profile[k]])) as unknown as FaceProfile;
  if (!isFaceProfile(profile)) throw new Error("invalid profile");
  const edited = p.edited.filter((k): k is ProfileKey => PROFILE_KEYS.includes(k));
  const source = p.source
    ? Object.fromEntries(
        PROFILE_KEYS.filter((k) => typeof p.source?.[k] === "string").map((k) => [k, String(p.source![k]).replace(/[^A-Za-z /,-]/g, "").slice(0, SOURCE_MAX)]),
      )
    : undefined;
  return JSON.stringify({ profile, edited, ...(source ? { source } : {}) });
}

export function saveProfile(storage: StorageLike, p: StoredProfile): void {
  try {
    storage.setItem(PROFILE_STORAGE_KEY, serializeProfile(p));
  } catch {
    /* private mode / quota: the app works without persistence */
  }
}

export function loadProfile(storage: StorageLike): StoredProfile | null {
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredProfile;
    if (!isFaceProfile(v?.profile)) return null;
    return { profile: v.profile, edited: Array.isArray(v.edited) ? v.edited.filter((k) => PROFILE_KEYS.includes(k)) : [], source: v.source };
  } catch {
    return null;
  }
}

export function clearProfile(storage: StorageLike): void {
  try {
    storage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
