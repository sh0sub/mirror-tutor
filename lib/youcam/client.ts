import {
  YOUCAM_BASE_URL,
  type CreditResponse,
  type FeatureCostResponse,
  type FileRequest,
  type FileResponse,
  type RunError,
  type RunTaskResponse,
  type TaskStatusResponse,
} from "./types";

/**
 * Thin transport over the YouCam V2 REST API. Every feature module (file, poll,
 * faceAnalyzer, makeupVto) talks to this interface so tests and mock mode can swap it.
 */
export interface YouCamTransport {
  readonly kind: "live" | "mock";
  createFile(req: FileRequest): Promise<FileResponse>;
  putUpload(url: string, method: string, headers: Record<string, string>, body: Uint8Array): Promise<void>;
  runTask(feature: string, body: unknown): Promise<RunTaskResponse>;
  getTask<R>(feature: string, taskId: string): Promise<TaskStatusResponse<R>>;
  getCredit(): Promise<CreditResponse>;
  getFeatureCost(startingToken?: string | null): Promise<FeatureCostResponse>;
  /** Server-side fetch of a result URL (2h presigned). The URL never leaves the server. */
  download(url: string): Promise<Uint8Array>;
}

export class YouCamHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly endpoint: string,
  ) {
    // Never include URLs with tokens or response bodies with result URLs in the message.
    super(`YouCam ${endpoint} failed: HTTP ${status} ${code}`);
    this.name = "YouCamHttpError";
  }
}

type FetchLike = typeof fetch;

export interface HttpTransportOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export function createHttpTransport({ apiKey, baseUrl = YOUCAM_BASE_URL, fetchImpl = fetch }: HttpTransportOptions): YouCamTransport {
  if (!apiKey) throw new Error("YOUCAM_API_KEY is required for live mode");
  const auth = { Authorization: `Bearer ${apiKey}` };

  async function call<T>(endpoint: string, init: RequestInit): Promise<T> {
    const res = await fetchImpl(`${baseUrl}${endpoint}`, init);
    const text = await res.text();
    let body: unknown = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const err = (body ?? {}) as RunError;
      throw new YouCamHttpError(res.status, err.error_code ?? "HttpError", endpoint.replace(/\/[^/]{24,}$/, "/:id"));
    }
    return body as T;
  }

  return {
    kind: "live",
    createFile: (req) =>
      call<FileResponse>("/s2s/v2.0/file", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    async putUpload(url, method, headers, body) {
      const res = await fetchImpl(url, { method, headers, body: body as BodyInit });
      if (!res.ok) throw new YouCamHttpError(res.status, "UploadFailed", "presigned-upload");
    },
    runTask: (feature, body) =>
      call<RunTaskResponse>(`/s2s/v2.0/task/${feature}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    getTask: <R>(feature: string, taskId: string) =>
      call<TaskStatusResponse<R>>(`/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: auth,
      }),
    getCredit: () => call<CreditResponse>("/s2s/v1.0/client/credit", { method: "GET", headers: auth }),
    getFeatureCost: (startingToken) => {
      const qs = new URLSearchParams({ page_size: "20" });
      if (startingToken) qs.set("starting_token", startingToken);
      return call<FeatureCostResponse>(`/s2s/v2.0/credit/feature-cost?${qs}`, { method: "GET", headers: auth });
    },
    async download(url) {
      const res = await fetchImpl(url);
      if (!res.ok) throw new YouCamHttpError(res.status, "DownloadFailed", "result-download");
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/** Sum of remaining units across all unit buckets (amount_dec preferred, amount is deprecated). */
export function totalCredit(res: CreditResponse): number {
  return (res.results ?? []).reduce((sum, r) => sum + (typeof r.amount_dec === "number" ? r.amount_dec : (r.amount ?? 0)), 0);
}
