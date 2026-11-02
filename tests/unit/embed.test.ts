import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { buildLesson } from "@/lib/lessons";
import { EMBED_LESSON, EMBED_NAME_MAX, embedFocusStep, embedMatch, embedProduct, embedProductFromQuery, parseCustomShade } from "@/lib/embed";
import { INTEGRATION_SNIPPET, PARTNER_SKU, embedQuery, integrationSnippet } from "@/lib/partner";
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

  it("?hex= is validated: 6 hex digits only, # optional, name capped and stripped of control characters", () => {
    expect(parseCustomShade("c94f5e", "Rose")).toEqual({ hex: "#C94F5E", name: "Rose" });
    expect(parseCustomShade("#C94F5E")).toEqual({ hex: "#C94F5E", name: "" });
    for (const bad of [null, undefined, "", "C94F5", "C94F5EE", "GGGGGG", "javascript:1", "#C94F5E<script>", "rgb(1,2,3)"]) expect(parseCustomShade(bad)).toBeNull();
    const long = parseCustomShade("C94F5E", `a\u0000b\n${"x".repeat(200)}`)!;
    expect(long.name.length).toBeLessThanOrEqual(EMBED_NAME_MAX);
    expect(long.name).not.toMatch(/[\u0000-\u001f]/);
  });

  it("a retailer shade is featured on the lip step with its own CIEDE2000 match and no catalog lookup; a bad hex falls back to ?sku=", () => {
    const custom = embedProductFromQuery({ hex: "C94F5E", name: "Rose Red", sku: "MT-CU-13N" });
    expect(custom).toMatchObject({ category: "lip_color", shades: ["#C94F5E"] });
    expect(custom.name.en).toBe("Rose Red");
    expect(embedFocusStep(profile, custom)).toBe(4);
    const m = embedMatch(buildLesson(EMBED_LESSON, profile).steps[3], custom)!;
    expect(m).toMatchObject({ featured: true, close: true });
    expect(m.deltaE).toBeLessThan(1);
    expect(embedProductFromQuery({ hex: "zzz", sku: "MT-CU-13N" }).sku).toBe("MT-CU-13N");
    expect(embedProductFromQuery({ hex: "C94F5E" }).name.en).toBe("Your shade");
  });

  it("the /partner snippet follows the shade and URL-encodes the name", () => {
    expect(embedQuery(null)).toBe(`sku=${PARTNER_SKU}`);
    expect(integrationSnippet(null)).toBe(INTEGRATION_SNIPPET);
    const snip = integrationSnippet({ hex: "#C94F5E", name: "Rose & Co" });
    expect(snip).toContain("/embed/lesson?hex=C94F5E&name=Rose%20%26%20Co");
    expect(snip).not.toContain("<script");
  });
});
