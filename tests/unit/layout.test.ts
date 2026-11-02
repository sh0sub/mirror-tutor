import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/i18n";

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
    expect(s).toContain('aspect="h-[23dvh] lg:h-auto lg:aspect-[7/8]"');
  });

  it("lesson: summary card keeps a bottom margin so the intensity chips clear the sticky bar", () => {
    expect(src("app/(flow)/lesson/page.tsx")).toContain("mx-4 mb-4 flex flex-col gap-3");
  });

  it("C1 capture: camera-off swaps the black box for a card with a filled sample CTA beside Upload; lg puts the CTA beside the preview", () => {
    const s = src("app/(flow)/capture/page.tsx");
    expect(s).toContain("<Screen wide>");
    expect(s).toContain('data-testid="camera-off-sample"');
    expect(s).toContain('cameraOff ? "hidden" : ""'); // video box and ring hidden
    expect(s).toMatch(/lg:grid lg:grid-cols-\[minmax\(0,420px\)_minmax\(0,1fr\)\]/);
  });

  it("S1 first paint: layout pre-sets the English pending class using the same rules as loadLang", () => {
    const s = src("app/layout.tsx");
    expect(s).toContain('getItem("mt.lang")');
    expect(s).toContain("lang-pending");
    expect(src("app/globals.css")).toContain("html.lang-pending body");
    expect(src("components/FlowProvider.tsx")).toContain('classList.remove("lang-pending")');
  });
});

describe("C21 guidance on the monolid trial and the grade try-it", () => {
  it("analyze scrolls to and pulses the Eyelid card once; the lesson nudge scrolls into view above the bottom bar", () => {
    const a = src("app/(flow)/analyze/page.tsx");
    expect(a).toContain("scrollIntoView");
    expect(a).toContain("mt-pulse");
    expect(src("app/globals.css")).toContain("@keyframes mt-pulse");
    const l = src("app/(flow)/lesson/page.tsx");
    expect(l).toContain("scroll-mb-44");
    expect(l).toContain("nudgeRef.current?.scrollIntoView");
  });

  it("grade shows the picked shade name+hex, a score delta badge, a region color legend and the 'Shop these 4 colors' button", () => {
    const g = src("app/(flow)/grade/page.tsx");
    expect(g).toContain("shade-name-");
    expect(g).toContain("delta-${region}");
    expect(g).toContain('data-testid="grade-legend"');
    expect(MESSAGES.seeProducts.en).toBe("Shop these 4 colors");
  });
});
