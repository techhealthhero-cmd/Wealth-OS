import { assertStagingSupabase } from "../../scripts/lib/assert-staging-supabase.mjs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function localEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // A reused E2E_TEST_EMAIL session does not need the file.
  }
  return values;
}

async function tabMetrics(page: Page) {
  return page.evaluate(() => {
    const tabs = document.querySelector("[data-testid='finance-list-tabs']");
    const calendar = document.querySelector("[data-testid='finance-calendar']");
    const panel = document.querySelector("[data-testid='finance-list-panel']");
    if (!(tabs instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
    const rect = tabs.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      viewportY: rect.top,
      documentY: rect.top + window.scrollY,
      scrollY: window.scrollY,
      calendarTop: calendar instanceof HTMLElement ? calendar.getBoundingClientRect().top : null,
      panelHeight: panelRect.height,
      viewportHeight: window.innerHeight,
    };
  });
}

test("switching ทั้งหมด and รอตรวจ keeps the sub-tab bar in place", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "One 390×844 WebKit pass is enough");
  test.skip(testInfo.project.use.browserName !== "webkit", "This check is the WebKit pass");
  test.setTimeout(120_000);
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

  const env = localEnv();
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const canCreate = Boolean(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_URL);
  test.skip(!canCreate && !(email && password), "Need a service role or E2E_TEST_EMAIL/E2E_TEST_PASSWORD");
  if (env.NEXT_PUBLIC_SUPABASE_URL) assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);

  const admin = canCreate
    ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
  const createdEmail = email || `e2e-finance-tabs-${Date.now()}@example.com`;
  const createdPassword = password || "TestPassword123!";
  let userId = "";

  try {
    if (admin && !email) {
      const created = await admin.auth.admin.createUser({
        email: createdEmail,
        password: createdPassword,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      userId = created.data.user!.id;
      expect(
        (
          await admin
            .from("profiles")
            .update({
              onboarding_completed: true,
              preferred_language: "th",
              display_name: "เทส",
              notebook_opening_mode: "off",
            })
            .eq("user_id", userId)
        ).error
      ).toBeNull();
    }

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(createdEmail);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(createdPassword);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000, waitUntil: "load" });
    await page.goto("/money/transactions", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("finance-calendar")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("finance-list-tabs")).toBeVisible();

    // Scroll the way the report does: the calendar is on screen and the
    // sub-tab bar sits below it, not pinned to the top of the viewport.
    await page.evaluate(() => {
      const tabs = document.querySelector("[data-testid='finance-list-tabs']");
      if (!(tabs instanceof HTMLElement)) return;
      const top = tabs.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - 520));
    });
    await page.waitForTimeout(100);

    const before = await tabMetrics(page);
    expect(before).not.toBeNull();
    expect(before!.calendarTop).not.toBeNull();
    expect(before!.viewportY).toBeGreaterThan(200);
    expect(before!.panelHeight).toBeGreaterThanOrEqual(before!.viewportHeight * 0.5 - 1);
    await page.screenshot({ path: testInfo.outputPath("all-before.png"), fullPage: false });

    await page.getByRole("tab", { name: "รอตรวจ" }).click();
    await page.waitForURL(/tab=pending/, { timeout: 20_000 });
    await expect(page.getByRole("tab", { name: "รอตรวจ" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("finance-calendar")).toBeVisible();
    // Let the post-navigation scroll hold finish before measuring.
    await page.waitForTimeout(900);

    const after = await tabMetrics(page);
    expect(after).not.toBeNull();
    expect(after!.calendarTop).not.toBeNull();
    expect(Math.abs(after!.documentY - before!.documentY)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.viewportY - before!.viewportY)).toBeLessThanOrEqual(2);
    expect(Math.abs(after!.scrollY - before!.scrollY)).toBeLessThanOrEqual(2);
    expect(after!.panelHeight).toBeGreaterThanOrEqual(after!.viewportHeight * 0.5 - 1);

    await page.screenshot({ path: testInfo.outputPath("review-scrolled.png"), fullPage: false });

    await page.getByRole("tab", { name: "ทั้งหมด" }).click();
    await page.waitForURL(/\/money\/transactions(?!.*tab=pending)/, { timeout: 20_000 });
    await expect(page.getByRole("tab", { name: "ทั้งหมด" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("finance-calendar")).toBeVisible();
    await page.waitForTimeout(900);

    const back = await tabMetrics(page);
    expect(back).not.toBeNull();
    expect(Math.abs(back!.viewportY - after!.viewportY)).toBeLessThanOrEqual(2);
    expect(Math.abs(back!.documentY - before!.documentY)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath("all-scrolled.png"), fullPage: false });
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId && admin) await admin.auth.admin.deleteUser(userId);
  }
});
