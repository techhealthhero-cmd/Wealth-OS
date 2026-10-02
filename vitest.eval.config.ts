import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Model evals (real API calls, cost money) — kept out of `npm test`.
 * Run: npx vitest run --config vitest.eval.config.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "server-only": path.resolve(dirname, "./tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
  },
});
