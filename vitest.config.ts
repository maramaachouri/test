
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "./reports/unit/coverage",
      include: [
        "features/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
      ],
    },
  },
});
