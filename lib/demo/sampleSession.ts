import { isFaceProfile, type StoredProfile } from "../profile";
import { isSampleId, type SampleId } from "./sample";

/**
 * A sample-model trial survives a reload or a deep link inside the same tab (sessionStorage, never localStorage):
 * only the sample id and its 5 profile attributes are kept. No photo, no render, no user data.
 */
export const SAMPLE_SESSION_KEY = "mt.sample";

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface SampleSnapshot {
  id: SampleId;
  stored: StoredProfile | null;
}

export function saveSampleSession(storage: StorageLike, snap: SampleSnapshot | null): void {
  try {
    if (snap) storage.setItem(SAMPLE_SESSION_KEY, JSON.stringify(snap));
    else storage.removeItem(SAMPLE_SESSION_KEY);
  } catch {
    /* storage blocked: the trial just does not survive a reload */
  }
}

export function loadSampleSession(storage: StorageLike): SampleSnapshot | null {
  try {
    const raw = storage.getItem(SAMPLE_SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id?: unknown; stored?: { profile?: unknown; edited?: unknown; source?: unknown } | null };
    if (!isSampleId(v.id)) return null;
    const s = v.stored;
    const stored = s && isFaceProfile(s.profile) && Array.isArray(s.edited) ? (s as unknown as StoredProfile) : null;
    return { id: v.id, stored };
  } catch {
    return null;
  }
}
