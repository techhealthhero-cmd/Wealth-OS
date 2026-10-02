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

/**
 * Per-unit income through the real form (migration 0036): ฿200 per drink ×
 * 150 drinks, paid on the 15th and month end → the form previews ฿30,000,
 * the server stores exactly that (derived, not trusted from the client),
 * and the card shows the rate and frequency.
 */
test("income source paid per unit: 200 × 150 = 30,000, semimonthly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile form flow");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(120_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-perunit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/earn/income");
    await page.getByRole("button", { name: /เพิ่มแหล่งรายได้/ }).first().click();
    await page.getByLabel("ชื่อแหล่งรายได้").fill("โฮส");
    await page.getByRole("radio", { name: "ได้ตามจำนวนงาน" }).click();
    await page.getByLabel("ได้ต่อหน่วย (บาท)").fill("200");
    await page.getByLabel("หน่วยเรียกว่า").fill("ดื่ม");
    await page.getByLabel("จำนวนต่อเดือน (เดือนปกติ)").fill("150");
    await expect(page.getByText("ประมาณ ฿30,000.00 ต่อเดือน")).toBeVisible();
    await expect(page.getByText("฿200.00 × 150 ดื่ม")).toBeVisible();

    await page.getByLabel("ความถี่").click();
    await page.getByRole("option", { name: "วันที่ 15 และสิ้นเดือน" }).click();
    await page.screenshot({ path: testInfo.outputPath("per-unit-form-390.png"), fullPage: true });
    const form = page.getByLabel("ชื่อแหล่งรายได้").locator("xpath=ancestor::form");
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();

    await expect
      .poll(async () => (await admin.from("income_sources").select("id", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0, {
        timeout: 15_000,
      })
      .toBe(1);
    const { data: row } = await admin
      .from("income_sources")
      .select("pay_basis, unit_rate, unit_label, expected_units_per_month, expected_monthly_income, frequency")
      .eq("user_id", userId)
      .single();
    expect(row).toMatchObject({ pay_basis: "per_unit", unit_label: "ดื่ม", frequency: "semimonthly" });
    expect(Number(row!.unit_rate)).toBe(200);
    expect(Number(row!.expected_units_per_month)).toBe(150);
    expect(Number(row!.expected_monthly_income)).toBe(30_000);

    // The card states how this income is earned.
    await page.getByText(/^แหล่งรายได้ · 1$/).click();
    await expect(page.getByText(/วันที่ 15 และสิ้นเดือน/)).toBeVisible();
    await expect(page.getByText(/฿200\.00 ต่อดื่ม × 150/)).toBeVisible();
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
