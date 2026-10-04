import type { NextConfig } from "next";

// Vinext also reads this file. Apply the Node environment alias only when the
// explicit self-hosted commands select it; Sites needs real Worker exports.
const nodeSelfHosted = process.env.AGRIDX_NODE_RUNTIME === "1";

const nextConfig: NextConfig = nodeSelfHosted ? {
  turbopack: {
    resolveAlias: { 'cloudflare:workers': './lib/node-runtime-env.ts' },
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'cloudflare:workers': './lib/node-runtime-env.ts',
    };
    return config;
  },
} : {};

export default nextConfig;
