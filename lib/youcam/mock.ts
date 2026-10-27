import type { YouCamTransport } from "./client";
import { YouCamHttpError } from "./client";
import type { Effect } from "./makeupVto";
import { mockRenderEffects } from "./mockRender";
import type { CreditResponse, FaceAttrResults, FeatureCostResponse, TaskStatusResponse } from "./types";
import faceMonolid from "../../fixtures/youcam/face-attr-analysis.monolid.spec.json";
import featureCost from "../../fixtures/youcam/feature-cost.spec.json";

/**
 * In-memory YouCam transport for mock mode (no API key) and tests. It follows the documented
 * flow — file → presigned PUT → task → running… → success — and enforces the "PUT before task"
 * rule, so code that skips a step fails here just like it would live.
 */
export interface MockOptions {
  /** Face Analyzer results to return (default: monolid fixture). */
  faceResults?: FaceAttrResults;
  /** How many polls report `running` before success. */
  runningPolls?: number;
  /** Starting balance reported by getCredit. */
  credit?: number;
  /** Make a task end in `error` with this engine code (per feature). */
  failFeature?: Partial<Record<string, string>>;
  /** Fail VTO tasks whose effects contain this category (to test partial completion). */
  failVtoCategory?: string;
  /** Override the VTO renderer (tests use a cheap one). */
  render?: (source: Uint8Array, effects: Effect[]) => Promise<Uint8Array>;
}

export interface MockTransport extends YouCamTransport {
  readonly calls: { createFile: number; put: number; runTask: Record<string, number>; getTask: number; download: number };
  /** Units the mock would have charged (success only, like the real API). */
  readonly charged: number;
}

const COST: Record<string, number> = { "face-attr-analysis": 10, "makeup-vto": 1 };

export function createMockTransport(opts: MockOptions = {}): MockTransport {
  const files = new Map<string, Uint8Array | null>();
  const tasks = new Map<string, { feature: string; body: Record<string, unknown>; polls: number; done?: boolean }>();
  let seq = 0;
  let charged = 0;
  let credit = opts.credit ?? 1000;
  const calls = { createFile: 0, put: 0, runTask: {} as Record<string, number>, getTask: 0, download: 0 };
  const render = opts.render ?? mockRenderEffects;

  const t: MockTransport = {
    kind: "mock",
    get calls() {
      return calls;
    },
    get charged() {
      return charged;
    },
    async createFile(req) {
      calls.createFile++;
      const f = req.files[0];
      const id = `mock-file-${++seq}`;
      files.set(id, null);
      return {
        status: 200,
        data: {
          files: [
            {
              content_type: f.content_type,
              file_name: f.file_name,
              file_id: id,
              requests: [{ url: `mock://upload/${id}`, method: "PUT", headers: { "Content-Type": f.content_type, "Content-Length": f.file_size } }],
            },
          ],
        },
      };
    },
    async putUpload(url, _method, _headers, body) {
      calls.put++;
      const id = url.replace("mock://upload/", "");
      if (!files.has(id)) throw new YouCamHttpError(404, "NoSuchUpload", "presigned-upload");
      files.set(id, body);
    },
    async runTask(feature, body) {
      calls.runTask[feature] = (calls.runTask[feature] ?? 0) + 1;
      const b = body as Record<string, unknown>;
      const fileId = b.src_file_id as string;
      // Real API: task on a file that was never PUT → 500 unknown_internal_error / 404.
      if (!files.get(fileId)) throw new YouCamHttpError(404, "FileNotUploaded", `/s2s/v2.0/task/${feature}`);
      if (credit < (COST[feature] ?? 1)) throw new YouCamHttpError(400, "CreditInsufficiency", `/s2s/v2.0/task/${feature}`);
      const id = `mock-task-${++seq}`;
      tasks.set(id, { feature, body: b, polls: 0 });
      return { status: 200, data: { task_id: id } };
    },
    async getTask<R>(feature: string, taskId: string): Promise<TaskStatusResponse<R>> {
      calls.getTask++;
      const task = tasks.get(taskId);
      if (!task || task.feature !== feature) throw new YouCamHttpError(400, "InvalidTaskId", `/s2s/v2.0/task/${feature}/:id`);
      task.polls++;
      if (task.polls <= (opts.runningPolls ?? 1)) return { status: 200, data: { task_status: "running" } };

      const failCode = opts.failFeature?.[feature];
      const effects = (task.body.effects as Effect[] | undefined) ?? [];
      const vtoFail = feature === "makeup-vto" && opts.failVtoCategory && effects.some((e) => e.category === opts.failVtoCategory);
      if (failCode || vtoFail) {
        return { status: 200, data: { task_status: "error", error: failCode ?? "error_inference", error_message: "mock failure" } };
      }
      if (!task.done) {
        task.done = true;
        const cost = COST[feature] ?? 1;
        charged += cost;
        credit -= cost;
      }
      if (feature === "face-attr-analysis") {
        const results = (opts.faceResults ?? (faceMonolid.data.results as FaceAttrResults)) as unknown as R;
        return { status: 200, data: { task_status: "success", results } };
      }
      return { status: 200, data: { task_status: "success", results: { url: `mock://result/${taskId}` } as unknown as R } };
    },
    async getCredit(): Promise<CreditResponse> {
      return { status: 200, results: [{ id: 1, type: "ApiSubsToken", amount: Math.floor(credit), amount_dec: credit }] };
    },
    async getFeatureCost(): Promise<FeatureCostResponse> {
      return featureCost as FeatureCostResponse;
    },
    async download(url) {
      calls.download++;
      const taskId = url.replace("mock://result/", "");
      const task = tasks.get(taskId);
      if (!task?.done) throw new YouCamHttpError(404, "NoSuchResult", "result-download");
      const src = files.get(task.body.src_file_id as string);
      if (!src) throw new YouCamHttpError(404, "NoSuchFile", "result-download");
      return render(src, (task.body.effects as Effect[]) ?? []);
    },
  };
  return t;
}
