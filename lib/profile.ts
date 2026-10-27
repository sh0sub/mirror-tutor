/**
 * Normalized face profile: the only face data Mirror Tutor keeps after analysis
 * (attributes only, no image — privacy principle ⑤). Values are app-level keys that the
 * technique rule table (lib/rules/techniques.json) branches on.
 */

export const EYELIDS = ["monolid", "inner_double", "double", "hooded"] as const;
export const EYE_SHAPES = ["almond", "round", "narrow"] as const;
export const LIP_SHAPES = ["thin", "average", "full"] as const;
export const FACE_SHAPES = ["oval", "round", "oblong", "square", "heart", "diamond", "triangle"] as const;
export const BROW_SHAPES = ["straight", "soft_angled", "hard_angled", "rounded", "obscured"] as const;

export type Eyelid = (typeof EYELIDS)[number];
export type EyeShape = (typeof EYE_SHAPES)[number];
export type LipShape = (typeof LIP_SHAPES)[number];
export type FaceShape = (typeof FACE_SHAPES)[number];
export type BrowShape = (typeof BROW_SHAPES)[number];

export interface FaceProfile {
  eyelid: Eyelid;
  eyeShape: EyeShape;
  lipShape: LipShape;
  faceShape: FaceShape;
  eyebrowShape: BrowShape;
}

export type ProfileKey = keyof FaceProfile;
export const PROFILE_KEYS: ProfileKey[] = ["eyelid", "eyeShape", "lipShape", "faceShape", "eyebrowShape"];

export const PROFILE_OPTIONS: { [K in ProfileKey]: readonly FaceProfile[K][] } = {
  eyelid: EYELIDS,
  eyeShape: EYE_SHAPES,
  lipShape: LIP_SHAPES,
  faceShape: FACE_SHAPES,
  eyebrowShape: BROW_SHAPES,
};

/** Profile plus which fields the user corrected on M2 ("직접 수정" badge). */
export interface StoredProfile {
  profile: FaceProfile;
  edited: ProfileKey[];
  /** Raw API labels kept for the M2 "읽은 값" caption, e.g. "Single-lid". Attributes only. */
  source?: Partial<Record<ProfileKey, string>>;
}

export function isFaceProfile(v: unknown): v is FaceProfile {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return PROFILE_KEYS.every((k) => (PROFILE_OPTIONS[k] as readonly string[]).includes(o[k] as string));
}
