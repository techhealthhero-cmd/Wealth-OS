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

test("tapping an account card flips it closed, tapping again flips it open", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-375", "One mobile pass is enough");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-card-flip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (
        await admin.from("accounts").insert([
          { user_id: userId, name: "Cash", account_type: "cash", currency_code: "THB", opening_balance: "1234.00" },
          { user_id: userId, name: "Dime", account_type: "investment", currency_code: "THB", opening_balance: "500.00" },
        ])
      ).error
    ).toBeNull();

    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 400)); });
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
    const back = face("Cash").filter({ hasText: "แตะเพื่อเปิดการ์ด" });
    await expect(front).toHaveAttribute("aria-hidden", "false");
    await expect(back).toHaveAttribute("aria-hidden", "true");

    // Tap -> closed: the back faces the viewer, the balance face is turned away.
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
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
