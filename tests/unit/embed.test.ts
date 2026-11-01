import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { buildLesson } from "@/lib/lessons";
import { EMBED_LESSON, embedFocusStep, embedMatch, embedProduct } from "@/lib/embed";
import { INTEGRATION_SNIPPET, PARTNER_SKU } from "@/lib/partner";
import { sampleModelById } from "@/lib/demo/sample";
import { MATCH_THRESHOLD } from "@/lib/shop";

const profile = sampleModelById("model-c").profile;

describe("/embed/lesson widget data", () => {
  it("features ?sku= when it is in the feed, else the demo SKU", () => {
    expect(embedProduct("MT-CU-13N").sku).toBe("MT-CU-13N");
    expect(embedProduct("nope").sku).toBe(PARTNER_SKU);
    expect(embedProduct(null).sku).toBe(PARTNER_SKU);
  });

  it("a lip SKU opens on the lip step; a foundation SKU on the base step", () => {
    expect(embedFocusStep(profile, embedProduct(PARTNER_SKU))).toBe(4);
    expect(embedFocusStep(profile, embedProduct("MT-CU-13N"))).toBe(1);
  });

  it("matches the featured SKU in its own category by CIEDE2000, other steps get the closest catalog product", () => {
    const plan = buildLesson(EMBED_LESSON, profile);
    const lip = embedMatch(plan.steps[3], embedProduct(PARTNER_SKU))!;
    expect(lip).toMatchObject({ featured: true, category: "lip_color" });
    expect(lip.deltaE).toBeGreaterThanOrEqual(0);
    expect(lip.close).toBe(lip.deltaE <= MATCH_THRESHOLD);
    const eyes = embedMatch(plan.steps[2], embedProduct(PARTNER_SKU))!;
    expect(eyes.featured).toBe(false);
    expect(eyes.product.category).not.toBe("lip_color");
  });

  it("the /partner snippet is a real iframe on /embed/lesson, not the old fictional script tag", () => {
    expect(INTEGRATION_SNIPPET).toContain("<iframe");
    expect(INTEGRATION_SNIPPET).toContain(`/embed/lesson?sku=${PARTNER_SKU}`);
    expect(INTEGRATION_SNIPPET).not.toContain("<script");
  });

  it("only /embed may be framed by other origins; the rest of the app is same-origin", async () => {
    const rules = await nextConfig.headers!();
    const csp = (src: string) => rules.find((r) => r.source === src)!.headers[0].value;
    expect(csp("/embed/:path*")).toBe("frame-ancestors *");
    expect(csp("/((?!embed).*)")).toBe("frame-ancestors 'self'");
  });
});
