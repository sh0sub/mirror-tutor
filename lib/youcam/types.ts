/**
 * YouCam API V2 wire types. Shapes follow the official OpenAPI bundles
 * (docs.perfectcorp.com/_bundle/reference/{ai_face_analyzer,makeup_vto,unit_system}.yaml, fetched 2026-10-27).
 * Fields marked "(미확인)" are not in the spec or contradict its examples and must be
 * confirmed with a live call (spike scripts in scripts/spike/).
 */

export const YOUCAM_BASE_URL = "https://yce-api-01.makeupar.com";

export type TaskStatus = "running" | "success" | "error";

/** POST /s2s/v2.0/file request body (FileV1.1). */
export interface FileRequest {
  files: Array<{ content_type: string; file_name: string; file_size: number }>;
}

/** POST /s2s/v2.0/file response (FileResponseV2). */
export interface FileResponse {
  status: number;
  data: {
    files: Array<{
      content_type: string;
      file_name: string;
      file_id: string;
      requests: Array<{ url: string; method: string; headers: Record<string, string | number> }>;
    }>;
  };
}

/** POST /s2s/v2.0/task/{feature} response. */
export interface RunTaskResponse {
  status: number;
  data: { task_id: string };
}

/** 400 body for run-task. */
export interface RunError {
  status: number;
  error?: string;
  error_code?: "InvalidParameters" | "CreditInsufficiency" | "InvalidStyleGroup" | "InvalidStyle" | "BadRequest" | string;
}

/** GET /s2s/v2.0/task/{feature}/{task_id}. */
export interface TaskStatusResponse<R> {
  status: number;
  data: {
    task_status: TaskStatus;
    error?: string | null;
    error_message?: string;
    results?: R;
  };
}

/** Face Analyzer results (subset we request + face_quality). */
export interface FaceAttrResults {
  face_quality?: { has_face?: boolean; area?: string; frontal?: string; lighting?: string; faceangle?: string };
  eyelid?: {
    left_eyelid?: "Hooded-lid" | "Single-lid" | "Double-lid" | "Deep-Set";
    right_eyelid?: "Hooded-lid" | "Single-lid" | "Double-lid" | "Deep-Set";
    left_shape?: "Narrow" | "Round" | "Almond";
    right_shape?: "Narrow" | "Round" | "Almond";
    left_angle?: string;
    right_angle?: string;
  };
  eyebrow?: {
    left_shape?: "Hard Angled" | "Soft Angled" | "Straight" | "Rounded" | "Obscured";
    right_shape?: "Hard Angled" | "Soft Angled" | "Straight" | "Rounded" | "Obscured";
  };
  faceshape?: "Triangle" | "Diamond" | "Heart" | "InvTriangle" | "Oblong" | "Oval" | "Round" | "Square" | "Unknown";
  lipshape?: Array<
    "Bow" | "Downturned" | "Full" | "Heavy Lower Lip" | "Heavy Upper Lip" | "Narrow" | "Round" | "Thin" | "Wide" | "Average"
  >;
}

/**
 * Makeup VTO results. The OpenAPI schema (TaskStatusResponseBodySingleUrlResultsV2) says
 * `results.url`, while the prose in the same document shows `results[].download_url`.
 * (미확인) We accept both shapes; spike #2 records the real one.
 */
export type MakeupVtoResults = { url?: string; download_url?: string } | Array<{ url?: string; download_url?: string }>;

/** GET /s2s/v1.0/client/credit. (미확인) v1 auth uses an access_token; we try the V2 API key. */
export interface CreditResponse {
  status: number;
  results: Array<{ id: number; type: string; amount?: number; amount_dec?: number; expiry?: number }>;
}

/** GET /s2s/v2.0/credit/feature-cost. */
export interface FeatureCostResponse {
  status: number;
  result: {
    next_token: string | null;
    skus: Array<{ description: string; amount: number; unit: string; proc_unit: number; run_task_url: string }>;
  };
}
