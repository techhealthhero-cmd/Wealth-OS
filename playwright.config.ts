import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const mobileBrowserName: "chromium" | "webkit" = process.env.E2E_WEBKIT === "1" ? "webkit" : "chromium";

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
    baseURL,
  },
  // Match Next.js's recommended Playwright setup: local runs bring up the
  // app automatically, while staging runs (E2E_BASE_URL set) never start a
  // second server or accidentally test the wrong environment.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "iphone-se-320", use: { viewport: { width: 320, height: 568 } } },
    { name: "iphone-360", use: { viewport: { width: 360, height: 800 } } },
    // The iPhone device descriptors default to WebKit. That executable is
    // blocked by Application Control on the primary Windows QA machine, so
    // responsive checks use Chromium there. Set E2E_WEBKIT=1 on CI/macOS to
    // exercise the same scenarios with WebKit and Safari-like device data.
    { name: "iphone-375", use: { ...devices["iPhone 13"], browserName: mobileBrowserName, viewport: { width: 375, height: 812 } } },
    { name: "iphone-390", use: { ...devices["iPhone 13"], browserName: mobileBrowserName, viewport: { width: 390, height: 844 } } },
    { name: "iphone-430", use: { ...devices["iPhone 14 Pro Max"], browserName: mobileBrowserName, viewport: { width: 430, height: 932 } } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
