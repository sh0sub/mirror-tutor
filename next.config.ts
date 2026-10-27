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
  outputFileTracingIncludes: { "/api/render": ["./public/demo/**"], "/api/analyze": ["./public/demo/**"] },
};

export default nextConfig;
