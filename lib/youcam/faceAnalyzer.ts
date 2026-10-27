import type { YouCamTransport } from "./client";
import { pollTask, type PollOptions } from "./poll";
import type { FaceAttrResults } from "./types";
import type { BrowShape, EyeShape, Eyelid, FaceProfile, FaceShape, LipShape, ProfileKey } from "../profile";

export const FACE_FEATURE = "face-attr-analysis";

/** The 5 features we pay for (1–5 features = 10u). Names are the OpenAPI `features` enum strings. */
export const FACE_FEATURES = ["eyelid", "eyeShape", "lipShape", "faceShape", "eyebrowShape"] as const;

export const FACE_ANGLE_STRICTNESS_LEVELS = ["strict", "high", "medium", "low", "flexible"] as const;
export const FACE_ANGLE_STRICTNESS: (typeof FACE_ANGLE_STRICTNESS_LEVELS)[number] = "flexible";

export function buildFaceAnalyzerRequest(fileId: string) {
  return {
    src_file_id: fileId,
    features: [...FACE_FEATURES],
    // OpenAPI enum (loosest last): strict (pitch≤4°, yaw≤6°, roll≤4°) · high (≤10°, API default) · medium (≤15°)
    // · low (≤20°) · flexible (≤30°). "high" rejected both stock test photos (error_face_angle_leftward/downward),
    // so we use the loosest level and rely on F1's capture guide + angle-error → retake mapping (lib/quality).
    face_angle_strictness_level: FACE_ANGLE_STRICTNESS,
  };
}

export async function runFaceAnalyzer(
  transport: YouCamTransport,
  fileId: string,
  poll?: PollOptions,
): Promise<FaceAttrResults> {
  const { data } = await transport.runTask(FACE_FEATURE, buildFaceAnalyzerRequest(fileId));
  return pollTask<FaceAttrResults>(transport, FACE_FEATURE, data.task_id, poll);
}

/**
 * Eyelid mapping. The API returns Single-lid | Double-lid | Hooded-lid | Deep-Set per eye.
 * - Left/right disagree with one Single and one Double → "inner_double" (속쌍/짝눈 — the partial crease case
 *   that the M2 correction sheet also offers). Decision documented in docs/api-notes.md.
 * - Deep-Set → "hooded": both hide lid space when the eye is open, so the same technique (shadow placed
 *   higher, visible-when-open liner) applies. (판단: 실호출 샘플로 재검토)
 */
export function mapEyelid(left?: string, right?: string): Eyelid {
  const one = (v?: string): Eyelid | undefined =>
    v === "Single-lid" ? "monolid" : v === "Double-lid" ? "double" : v === "Hooded-lid" || v === "Deep-Set" ? "hooded" : undefined;
  const l = one(left);
  const r = one(right);
  if (l && r && l !== r) {
    const pair = new Set([l, r]);
    if (pair.has("monolid") && pair.has("double")) return "inner_double";
    if (pair.has("hooded")) return "hooded";
  }
  return l ?? r ?? "double";
}

export function mapEyeShape(left?: string, right?: string): EyeShape {
  const v = left ?? right;
  return v === "Round" ? "round" : v === "Narrow" ? "narrow" : "almond";
}

/** lipshape is an array of tags; Thin/Narrow win over Full/Heavy* when both appear (thin-lip technique is the safer default). */
export function mapLipShape(tags?: string[]): LipShape {
  const t = new Set(tags ?? []);
  if (t.has("Thin") || t.has("Narrow")) return "thin";
  if (t.has("Full") || t.has("Heavy Lower Lip") || t.has("Heavy Upper Lip") || t.has("Round")) return "full";
  return "average";
}

export function mapFaceShape(v?: string): FaceShape {
  switch (v) {
    case "Round":
      return "round";
    case "Oblong":
      return "oblong";
    case "Square":
      return "square";
    case "Heart":
    case "InvTriangle":
      return "heart";
    case "Diamond":
      return "diamond";
    case "Triangle":
      return "triangle";
    default:
      return "oval"; // Oval and Unknown
  }
}

export function mapBrowShape(left?: string, right?: string): BrowShape {
  const v = left && left !== "Obscured" ? left : (right ?? left);
  switch (v) {
    case "Straight":
      return "straight";
    case "Soft Angled":
      return "soft_angled";
    case "Hard Angled":
      return "hard_angled";
    case "Rounded":
      return "rounded";
    default:
      return "obscured";
  }
}

export interface NormalizedFace {
  profile: FaceProfile;
  /** Raw API labels for the M2 caption. */
  source: Record<ProfileKey, string>;
}

export function normalizeFaceAttributes(r: FaceAttrResults): NormalizedFace {
  const e = r.eyelid ?? {};
  const b = r.eyebrow ?? {};
  return {
    profile: {
      eyelid: mapEyelid(e.left_eyelid, e.right_eyelid),
      eyeShape: mapEyeShape(e.left_shape, e.right_shape),
      lipShape: mapLipShape(r.lipshape),
      faceShape: mapFaceShape(r.faceshape),
      eyebrowShape: mapBrowShape(b.left_shape, b.right_shape),
    },
    source: {
      eyelid: [e.left_eyelid, e.right_eyelid].filter(Boolean).join(" / ") || "Unknown",
      eyeShape: e.left_shape ?? e.right_shape ?? "Unknown",
      lipShape: (r.lipshape ?? []).join(", ") || "Unknown",
      faceShape: r.faceshape ?? "Unknown",
      eyebrowShape: b.left_shape ?? b.right_shape ?? "Unknown",
    },
  };
}
