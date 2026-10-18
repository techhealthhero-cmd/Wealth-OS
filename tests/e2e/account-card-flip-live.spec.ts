import { assertStagingSupabase } from "../../scripts/lib/assert-staging-supabase.mjs";
import { expect, test } from "@playwright/test";
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

test("tapping an account card flips it to what the money is for, tapping again flips it back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-375", "One mobile pass is enough");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-card-flip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    const inserted = await admin
      .from("accounts")
      .insert([
        { user_id: userId, name: "Cash", account_type: "cash", institution: "กสิกร", currency_code: "THB", opening_balance: "1234.00" },
        { user_id: userId, name: "Dime", account_type: "investment", currency_code: "THB", opening_balance: "500.00" },
      ])
      .select("id, name");
    expect(inserted.error).toBeNull();
    const cashId = inserted.data!.find((a) => a.name === "Cash")!.id;

    // With migration 0045 the back shows the purpose; without it, the type.
    const purposeSet = await admin.from("accounts").update({ purpose: "ใช้จ่ายรายวัน" }).eq("id", cashId);
    const cashBackLabel = purposeSet.error ? "เงินสด" : "ใช้จ่ายรายวัน";
    testInfo.annotations.push({ type: "migration-0045", description: purposeSet.error ? "not applied" : "applied" });

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/money/accounts");
    await expect(page.locator(".page-curl-sheet")).toHaveCount(0);
    // Both faces stay in the DOM; the one turned away is aria-hidden + inert.
    const face = (text: string) => page.getByText(text).locator('xpath=ancestor::*[@data-slot="card"][1]');
    const front = face("฿1,234.00");
    const back = page.locator('[data-slot="card"]').filter({ hasText: "Cash" }).filter({ hasNotText: "฿1,234.00" });
    await expect(back).toContainText(cashBackLabel);
    await expect(front).toHaveAttribute("aria-hidden", "false");
    await expect(back).toHaveAttribute("aria-hidden", "true");
    // The back reads as an ordinary card: no "closed" wording, no masked digits.
    await expect(back).not.toContainText("ปิดการ์ด");
    await expect(back).not.toContainText("••••");
    await expect(back).toContainText("Cash");

    // Tap -> the back faces the viewer, the balance face is turned away.
    await page.getByText("฿1,234.00").click();
    await expect(front).toHaveAttribute("aria-hidden", "true");
    await expect(back).toHaveAttribute("aria-hidden", "false");
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath("closed.png") });

    // The other card is untouched, and its ⋮ menu opens without flipping it.
    const dime = face("฿500.00");
    await expect(dime).toHaveAttribute("aria-hidden", "false");
    await dime.getByRole("button", { name: "ตัวเลือกเพิ่มเติม" }).click();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dime).toHaveAttribute("aria-hidden", "false");
    await expect(front).toHaveAttribute("aria-hidden", "true");

    // Remembered across a reload.
    await page.reload();
    await expect(front).toHaveAttribute("aria-hidden", "true");
    await expect(back).toHaveAttribute("aria-hidden", "false");

    // Tap again -> open.
    await back.click();
    await expect(front).toHaveAttribute("aria-hidden", "false");
    await expect(back).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath("open.png") });

    // Editing an account still saves with the purpose left empty (also before 0045).
    await dime.getByRole("button", { name: "ตัวเลือกเพิ่มเติม" }).click();
    await page.getByRole("menuitem", { name: "แก้ไข" }).click();
    await expect(page.getByLabel(/เงินนี้มีไว้ทำอะไร/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("form.png") });
    await page.getByLabel("ชื่อบัญชี").fill("Dime Invest");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("Dime Invest")).toHaveCount(2);

    expect(consoleErrors).toEqual([]);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
