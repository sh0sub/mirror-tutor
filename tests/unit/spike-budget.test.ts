import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SpikeBudget, redactForDocs, stats } from "@/scripts/spike/budget";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("spike unit guard (scripts/spike)", () => {
  it("never lets one run pass SPIKE_MAX_UNITS (Face Analyzer 10u ×3 + VTO fits 55; a 6th analysis does not)", () => {
    const b = new SpikeBudget(55, 55, null);
    for (let i = 0; i < 5; i++) b.reserve(10, `face ${i}`);
    expect(b.canSpend(10)).toBe(false);
    expect(() => b.reserve(10, "face 6")).toThrow(/unit guard/);
    for (let i = 0; i < 5; i++) b.reserve(1, `vto ${i}`);
    expect(b.spent).toBe(55);
    expect(() => b.reserve(1, "one more")).toThrow();
  });

  it("refunds tasks that ended in error and keeps a cumulative ledger across runs", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mt-spike-"));
    dirs.push(dir);
    const ledger = path.join(dir, "ledger.json");
    const run1 = new SpikeBudget(55, 55, ledger);
    run1.reserve(30, "faces");
    run1.reserve(10, "bad");
    run1.refund(10, "bad");
    expect(run1.ledgerTotal).toBe(30);
    const run2 = new SpikeBudget(55, 55, ledger);
    expect(run2.canSpend(25)).toBe(true);
    expect(run2.canSpend(26)).toBe(false);
  });

  it("the planned `all` run (3 analyses + 8 VTO + 2 probes) costs at most 40u", () => {
    const b = new SpikeBudget(55, 55, null);
    for (let i = 0; i < 3; i++) b.reserve(10, "face");
    for (let i = 0; i < 10; i++) b.reserve(1, "vto");
    expect(b.spent).toBe(40);
  });

  it("redacts URLs and ids before writing docs/fixtures", () => {
    expect(
      redactForDocs({ status: 200, data: { task_id: "abc", results: { url: "https://s3/x?sig=1" }, files: [{ file_id: "f", requests: [{ url: "https://u" }] }] } }),
    ).toEqual({ status: 200, data: { task_id: "[redacted]", results: { url: "[redacted]" }, files: [{ file_id: "[redacted]", requests: [{ url: "[redacted]" }] }] } });
    expect(redactForDocs(["https://a", "Single-lid"])).toEqual(["[redacted-url]", "Single-lid"]);
    expect(stats([1500, 2500])).toEqual({ n: 2, min: 1.5, avg: 2, max: 2.5 });
  });
});
