import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      {
        find: /^next-intl$/,
        replacement: fileURLToPath(new URL("./src/lib/next-intl/index.tsx", import.meta.url)),
      },
      {
        find: /^next-intl\/middleware$/,
        replacement: fileURLToPath(new URL("./src/lib/next-intl/middleware.ts", import.meta.url)),
      },
      {
        find: /^next-intl\/navigation$/,
        replacement: fileURLToPath(new URL("./src/lib/next-intl/navigation.tsx", import.meta.url)),
      },
      {
        find: /^next-intl\/routing$/,
        replacement: fileURLToPath(new URL("./src/lib/next-intl/routing.ts", import.meta.url)),
      },
      {
        find: /^next-intl\/server$/,
        replacement: fileURLToPath(new URL("./src/lib/next-intl/server.ts", import.meta.url)),
      },
    ],
  },
  test: {
    css: true,
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "tests/e2e/**"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
