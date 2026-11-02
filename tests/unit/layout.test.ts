import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(path.resolve(import.meta.dirname, "../..", p), "utf8");

/** C15 M4/M5: layout guards. Classes are the only place the 1440 two-column layout and the 390 hero height live. */
describe("responsive layout guards", () => {
  it("analyze: wide screen, face column left (sticky), result column right, 390 stays one column", () => {
    const s = src("app/(flow)/analyze/page.tsx");
    expect(s).toContain("<Screen wide>");
    expect(s).toMatch(/lg:grid lg:grid-cols-\[minmax\(0,440px\)_minmax\(0,1fr\)\]/);
    expect(s).toContain("lg:sticky lg:top-[72px] lg:col-start-1 lg:row-start-1");
    expect(s).toContain("lg:col-start-2 lg:row-start-1");
  });

  it("shop: sticky bare face left, product list is a plain side panel (sheet chrome hidden at lg)", () => {
    const s = src("app/(flow)/shop/page.tsx");
    expect(s).toContain("<Screen wide>");
    expect(s).toContain("lg:sticky lg:top-[72px] lg:col-start-1 lg:row-start-1 lg:h-auto lg:aspect-[3/4]");
    expect(s).toContain("lg:col-start-2 lg:row-start-1 lg:mt-0 lg:min-h-0");
    expect(s).toContain("h-1.5 w-10 rounded-full bg-line lg:hidden");
    expect(s).toContain("lg:top-0"); // the whole 3:4 face is shown in the desktop column
  });

  it("home: 390 hero is viewport-relative (tagline clears the CTA tray), desktop keeps 7:8", () => {
    const s = src("app/page.tsx");
    expect(s).toContain('aspect="h-[34dvh] lg:h-auto lg:aspect-[7/8]"');
  });

  it("lesson: summary card keeps a bottom margin so the intensity chips clear the sticky bar", () => {
    expect(src("app/(flow)/lesson/page.tsx")).toContain("mx-4 mb-4 flex flex-col gap-3");
  });
});
