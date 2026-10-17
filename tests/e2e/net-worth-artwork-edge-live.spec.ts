import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function localEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

async function expectArtworkLoaded(artwork: Locator) {
  await expect(artwork).toBeVisible();
  await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function waitForPageTurn(page: Page) {
  await expect(page.locator(".page-curl-sheet")).toHaveCount(0);
}

test("Net Worth no-history and first Emergency Fund setup show the approved artwork", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "One mobile visual pass is enough");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-net-worth-art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "en" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "Cash", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/money/net-worth");
    await waitForPageTurn(page);
    await expect(page.getByText(/not enough history yet/i)).toBeVisible();
    await expectArtworkLoaded(page.locator('img[src*="no-history.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("net-worth-no-history-light-390.png"), fullPage: true });

    await page.getByRole("button", { name: /toggle theme|สลับธีม/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectArtworkLoaded(page.locator('img[src*="no-history.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("net-worth-no-history-dark-390.png"), fullPage: true });

    await page.goto("/plan/emergency-fund");
    await waitForPageTurn(page);
    await expect(page.getByText(/no essential-expense data yet/i)).toBeVisible();
    await expect(page.getByText("Target (months of essential expenses)", { exact: true })).toBeVisible();
    await expectArtworkLoaded(page.locator('img[src*="emergency-fund.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("emergency-fund-first-setup-dark-390.png"), fullPage: true });

    await page.getByRole("button", { name: /toggle theme|สลับธีม/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expectArtworkLoaded(page.locator('img[src*="emergency-fund.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("emergency-fund-first-setup-light-390.png"), fullPage: true });
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
