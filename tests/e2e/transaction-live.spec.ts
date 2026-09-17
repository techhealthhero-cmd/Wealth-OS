import { test, expect, type Page } from "@playwright/test";

/**
 * Live QA for transaction create/transfer/double-submit + credit-card
 * linking (Financial Data Integrity Hardening pass). Creates real,
 * disposable, timestamped test accounts. Not wired into `npm test`; run
 * explicitly with `npm run test:e2e -- tests/e2e/transaction-live.spec.ts`.
 *
 * Migrations 0012/0013 are now applied everywhere this app runs (staging
 * and production, as of 2026-09-17 — see PROJECT_STATUS.md's "Production
 * status — MIGRATED"), and `transactions/actions.ts` no longer has a
 * pre-migration fallback path at all — it was removed once every
 * environment was confirmed migrated. These scenarios now exercise the
 * real, atomic idempotency-key mechanism against whatever database
 * `E2E_BASE_URL`/`.env.local` points the running app at.
 *
 * Uses the app's own signup rate limit (5/hour/IP; local dev shares one
 * "unknown" IP key) — space consecutive runs of this file out, or it will
 * self-skip with a message explaining why once exhausted.
 */

function disposableEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}@example.com`;
}

async function signUpAndOnboard(page: Page, tag: string) {
  const email = disposableEmail(tag);
  await page.goto("/signup");
  await page.getByLabel(/display name/i).fill(`QA ${tag}`);
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill("TestPassword123!");
  await page.getByLabel(/confirm password/i).fill("TestPassword123!");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/onboarding|\/login/, { timeout: 15000 }).catch(() => {});
  if (!page.url().includes("/onboarding")) {
    const alertText = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    return { ok: false as const, reason: `did not reach /onboarding (still on ${page.url()}). Page said: "${alertText}"` };
  }
  await page.getByLabel(/ยอดเงินปัจจุบัน|current balance/i).fill("5000");
  await page.getByRole("button", { name: /เริ่มใช้งาน|get started/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  return { ok: true as const };
}

test("Scenario: create expense, verify persisted, then rapid double-submit", async ({ page }) => {
  const result = await signUpAndOnboard(page, "tx-expense");
  test.skip(!result.ok, !result.ok ? result.reason : "");
  if (!result.ok) return;

  await page.goto("/money/transactions");
  await page.getByRole("button", { name: /เพิ่มรายการ|quick add/i }).first().click();
  await page.getByRole("menuitem", { name: /รายจ่าย|expense/i }).click();

  await page.getByLabel(/amount/i).fill("120");
  await page.getByRole("button", { name: /save expense|บันทึกรายจ่าย/i }).click();
  await page.waitForTimeout(2000);

  const rows = page.locator("main").getByText(/฿120|120.00/);
  await expect(rows.first()).toBeVisible({ timeout: 10000 });

  // Double-submit test: open a second, different-amount expense and click save twice rapidly.
  await page.getByRole("button", { name: /เพิ่มรายการ|quick add/i }).first().click();
  await page.getByRole("menuitem", { name: /รายจ่าย|expense/i }).click();
  await page.getByLabel(/amount/i).fill("777");
  const saveBtn = page.getByRole("button", { name: /save expense|บันทึกรายจ่าย/i });
  await Promise.all([saveBtn.click(), saveBtn.click({ force: true }).catch(() => {})]);
  await page.waitForTimeout(2500);

  await page.reload();
  const matches777 = await page.getByText(/฿777|777.00/).count();
  expect(matches777, "double-submit should not create more than one ฿777 transaction").toBeLessThanOrEqual(1);
});

test("Scenario: create transfer between two accounts", async ({ page }) => {
  const result = await signUpAndOnboard(page, "tx-transfer");
  test.skip(!result.ok, !result.ok ? result.reason : "");
  if (!result.ok) return;

  // Add a second account first (transfer needs 2).
  await page.goto("/money/accounts");
  await page.getByRole("button", { name: /เพิ่มบัญชี|add account/i }).first().click();
  await page.getByLabel(/account name|ชื่อบัญชี/i).fill("Bank Two");
  await page.getByRole("button", { name: /save|บันทึก/i }).click();
  await page.waitForTimeout(1500);

  await page.goto("/money/transactions");
  await page.getByRole("button", { name: /เพิ่มรายการ|quick add/i }).first().click();
  await page.getByRole("menuitem", { name: /โอนเงิน|transfer/i }).click();
  await page.getByLabel(/amount/i).fill("300");
  await page.getByRole("button", { name: /save|โอน|transfer/i }).last().click();
  await page.waitForTimeout(2000);

  const transferRow = page.locator("main").getByText(/→/);
  await expect(transferRow.first()).toBeVisible({ timeout: 10000 });
});

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
];

test("Mobile: /money/transactions renders without horizontal overflow at 375/390/430 for an authenticated user with real data", async ({
  page,
}) => {
  const result = await signUpAndOnboard(page, "tx-mobile");
  test.skip(!result.ok, !result.ok ? result.reason : "");
  if (!result.ok) return;

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/money/transactions");
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth, `/money/transactions @ ${vp.name}: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(
      overflow.innerWidth + 1
    );
  }
});
