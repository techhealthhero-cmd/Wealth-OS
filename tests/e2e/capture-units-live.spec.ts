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

// Migration 0044: a unit price saved on the profile turns "ได้ 10 ดื่ม" into ฿2,000 income.
test("a counted unit saved on the profile prices a typed capture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "One mobile pass is enough");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-units-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "Cash", account_type: "cash", currency_code: "THB", opening_balance: "0" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/profile");
    await expect(page.locator(".page-curl-sheet")).toHaveCount(0);
    await page.getByLabel("คำที่ใช้นับ").fill("ดื่ม");
    await page.getByLabel("ราคาต่อหน่วย (บาท)").fill("200");
    await page.getByRole("button", { name: "เพิ่มหน่วยนับ" }).click();
    await expect
      .poll(async () => (await admin.from("capture_units").select("unit_label, unit_price, type").eq("user_id", userId)).data)
      .toEqual([{ unit_label: "ดื่ม", unit_price: 200, type: "income" }]);

    await page.goto("/dashboard");
    // The centre mic opens the voice notebook; its paper also takes typing.
    await page.getByRole("button", { name: "จดรายรับรายจ่ายด้วยเสียง" }).click();
    const paper = page.getByRole("textbox", { name: "ข้อความที่จด แตะเพื่อแก้ไข" });
    await paper.fill("วันนี้ได้ 10 ดื่ม");
    await paper.blur();
    await expect(page.getByText(/฿2,000/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/ดื่มละกี่บาท|ละกี่บาท/)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("capture.png") });
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
