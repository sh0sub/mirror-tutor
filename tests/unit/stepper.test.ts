import { describe, expect, it } from "vitest";
import { stepDotKind } from "@/lib/stepper";

describe("stepDotKind", () => {
  it("step 1 of 4: one active, the rest pending, none done", () => {
    expect([1, 2, 3, 4].map((i) => stepDotKind(i, 1))).toEqual(["active", "pending", "pending", "pending"]);
  });
  it("step 3 of 4: earlier done, later pending", () => {
    expect([1, 2, 3, 4].map((i) => stepDotKind(i, 3))).toEqual(["done", "done", "active", "pending"]);
  });
});
