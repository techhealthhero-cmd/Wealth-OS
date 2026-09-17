import { defineConfig, devices } from "@playwright/test";

/**
 * Mobile responsive/overflow QA (2026-09 — real-device iPhone bug audit).
 * Not part of `npm test` (that's Vitest/unit tests) — run explicitly with
 * `npm run test:e2e`. Requires a running app at BASE_URL (defaults to
 * localhost:3000 — run `npm run dev` or `npm run build && npm run start`
 * first).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  },
  projects: [
    { name: "iphone-se-320", use: { viewport: { width: 320, height: 568 } } },
    { name: "iphone-360", use: { viewport: { width: 360, height: 800 } } },
    { name: "iphone-375", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } } },
    { name: "iphone-390", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    { name: "iphone-430", use: { ...devices["iPhone 14 Pro Max"], viewport: { width: 430, height: 932 } } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
