import { test, expect, type Page } from "@playwright/test";

/**
 * One signup, four viewports — deliberately combined into a single test so
 * it consumes only one slot of the app's own signup rate limit (5/hour per
 * IP; local dev shares one "unknown" IP key with no x-forwarded-for header,
 * so it's easy to exhaust across separate test runs). Checks onboarding,
 * dashboard, and /money/accounts for horizontal overflow at 375/390/430/
 * desktop using real navigation with a real authenticated session.
 */

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "desktop", width: 1280, height: 800 },
];

async function checkOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(result.scrollWidth, `${label}: ${JSON.stringify(result)}`).toBeLessThanOrEqual(result.innerWidth + 1);
}

test("onboarding + dashboard + accounts: no horizontal overflow at 375/390/430/desktop (real session)", async ({ page }) => {
  const email = `e2e-mobile-${Date.now()}@example.com`;

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/signup");
  await page.getByLabel(/display name/i).fill("QA Mobile");
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill("TestPassword123!");
  await page.getByLabel(/confirm password/i).fill("TestPassword123!");
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL(/\/onboarding|\/signup/, { timeout: 15000 });
  if (page.url().includes("/signup")) {
    const alertText = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    test.skip(true, `Signup did not proceed (still on /signup) — likely rate-limited. Page said: "${alertText}"`);
    return;
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/onboarding");
    await checkOverflow(page, `/onboarding @ ${vp.name}`);
  }

  // Fill and submit onboarding once, at the 390 width, to reach the dashboard.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding");
  await page.getByLabel(/ยอดเงินปัจจุบัน|current balance/i).fill("1234");
  await page.getByRole("button", { name: /เริ่มใช้งาน|get started/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/dashboard");
    await checkOverflow(page, `/dashboard @ ${vp.name}`);
    await page.goto("/money/accounts");
    await checkOverflow(page, `/money/accounts @ ${vp.name}`);
  }
});
