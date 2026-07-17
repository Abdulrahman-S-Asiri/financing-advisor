import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}/:path*`,
      },
    ];
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "next-intl$": path.resolve(__dirname, "src/lib/next-intl/index.tsx"),
      "next-intl/middleware$": path.resolve(
        __dirname,
        "src/lib/next-intl/middleware.ts",
      ),
      "next-intl/navigation$": path.resolve(
        __dirname,
        "src/lib/next-intl/navigation.tsx",
      ),
      "next-intl/routing$": path.resolve(
        __dirname,
        "src/lib/next-intl/routing.ts",
      ),
      "next-intl/server$": path.resolve(__dirname, "src/lib/next-intl/server.ts"),
    };

    return config;
  },
};

export default nextConfig;
