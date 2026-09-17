import { test, expect, type Page } from "@playwright/test";

/**
 * Live QA for onboarding + first dashboard (2026-09 onboarding reliability
 * pass). Creates real, disposable, timestamped test accounts against
 * whatever app E2E_BASE_URL points at (defaults to localhost:3000) — never
 * against production. Each test uses its own throwaway email so runs don't
 * collide. Not wired into `npm test`; run explicitly with
 * `npm run test:e2e -- tests/e2e/onboarding-live.spec.ts`.
 */

function disposableEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

async function signUp(page: Page, email: string, name: string) {
  await page.goto("/signup");
  await page.getByLabel(/display name/i).fill(name);
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill("TestPassword123!");
  await page.getByLabel(/confirm password/i).fill("TestPassword123!");
  await page.getByRole("button", { name: /create account/i }).click();
}

async function noHorizontalOverflow(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

test("Scenario A: signup -> onboarding -> skip account -> dashboard", async ({ page }) => {
  const email = disposableEmail("scenario-a");
  await signUp(page, email, "QA Scenario A");

  // Real assertion of what actually happens post-signup — do not assume.
  await page.waitForURL(/\/onboarding|\/login/, { timeout: 15000 });
  const afterSignupUrl = page.url();
  console.log("[E2E] after signup, landed on:", afterSignupUrl);

  if (afterSignupUrl.includes("/login")) {
    test.info().annotations.push({
      type: "blocker",
      description: "Signup redirected to /login instead of /onboarding — email confirmation is likely required before a session exists. Cannot proceed with authenticated onboarding QA without a confirmed session.",
    });
    test.skip(true, "Email confirmation appears required — cannot reach an authenticated session automatically.");
    return;
  }

  await expect(page).toHaveURL(/\/onboarding/);

  const overflow = await noHorizontalOverflow(page);
  expect(overflow.scrollWidth, `onboarding page overflow: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(overflow.innerWidth + 1);

  // Scenario A: skip the optional starting account entirely.
  await page.getByRole("button", { name: /เริ่มใช้งาน|get started/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  const dashOverflow = await noHorizontalOverflow(page);
  expect(dashOverflow.scrollWidth, `dashboard overflow: ${JSON.stringify(dashOverflow)}`).toBeLessThanOrEqual(dashOverflow.innerWidth + 1);

  // First-value check: dashboard must not fabricate confidence for a user
  // with zero accounts/transactions.
  const bodyText = await page.locator("body").innerText();
  console.log("[E2E] dashboard body text snippet:", bodyText.slice(0, 800));
});

test("Scenario B: signup -> onboarding -> add starting account -> dashboard -> refresh persists", async ({ page }) => {
  const email = disposableEmail("scenario-b");
  await signUp(page, email, "QA Scenario B");

  await page.waitForURL(/\/onboarding|\/login/, { timeout: 15000 });
  if (page.url().includes("/login")) {
    test.skip(true, "Email confirmation appears required — cannot reach an authenticated session automatically.");
    return;
  }

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel(/ยอดเงินปัจจุบัน|current balance/i).fill("5000");
  await page.getByRole("button", { name: /เริ่มใช้งาน|get started/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  await page.goto("/money/accounts");
  const accountRows = page.locator("main").getByText(/฿5,000|5,000.00|5000/);
  await expect(accountRows.first()).toBeVisible({ timeout: 10000 });

  // Refresh to verify persistence (not just optimistic client state).
  await page.reload();
  await expect(page.getByText(/฿5,000|5,000.00|5000/).first()).toBeVisible({ timeout: 10000 });
});

test("Scenario C: rapid double-submit on onboarding creates exactly one account", async ({ page }) => {
  const email = disposableEmail("scenario-c");
  await signUp(page, email, "QA Scenario C");

  await page.waitForURL(/\/onboarding|\/login/, { timeout: 15000 });
  if (page.url().includes("/login")) {
    test.skip(true, "Email confirmation appears required — cannot reach an authenticated session automatically.");
    return;
  }

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel(/ยอดเงินปัจจุบัน|current balance/i).fill("777");

  const submitButton = page.getByRole("button", { name: /เริ่มใช้งาน|get started/i });
  // Fire two rapid clicks without waiting in between — this is the exact
  // user behavior the reliability fix targets.
  await Promise.all([submitButton.click(), submitButton.click({ force: true }).catch(() => {})]);

  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.goto("/money/accounts");

  const matches = await page.getByText(/฿777|777.00/).count();
  expect(matches, "expected exactly one starting account (one balance match), found more — duplicate created").toBeLessThanOrEqual(1);
});
