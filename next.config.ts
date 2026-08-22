import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent ~/pnpm-lock.yaml otherwise becomes the Turbopack project root and
  // breaks the React Client Manifest (global-error / RSC module IDs).
  outputFileTracingRoot: root,
  turbopack: {
    root,
  },
};

export default nextConfig;
