import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local").slice(0, 7);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: `${pkg.version}+${commit}` },
  poweredByHeader: false,
};

export default nextConfig;
