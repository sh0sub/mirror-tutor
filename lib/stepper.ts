export type StepDotKind = "active" | "done" | "pending";

/** Lesson stepper dot: active = current step, done = an earlier step already viewed, pending = not reached yet. Render state never reads as "done". */
export function stepDotKind(index: number, k: number): StepDotKind {
  return index === k ? "active" : index < k ? "done" : "pending";
}
