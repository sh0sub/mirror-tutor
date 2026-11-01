import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // sharp is a native module; keep it out of the server bundle.
  serverExternalPackages: ["sharp"],
  poweredByHeader: false,
  outputFileTracingRoot: root,
  // demo mode reads the illustrated sample model from public/demo at runtime
  // The app may not be framed, except the retailer widget under /embed (the iframe a partner drops into a product page).
  async headers() {
    return [
      { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/((?!embed).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
    ];
  },
  outputFileTracingIncludes: { "/api/render": ["./public/demo/**"], "/api/analyze": ["./public/demo/**"] },
};

export default nextConfig;
