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

const RECAP = "กินข้าว 40 บาท น้ำ 10 บาท ขนม 50 วินมอไซต์ 40 ไปกลับ 80 วันนี้เงินเดือนออก 20,000 แม่ให้ 2,000";

/**
 * Evening recap, end to end against the real database: one sentence (typed,
 * or spoken through the hold-to-talk mic when the app was built with
 * NEXT_PUBLIC_SPEECH_MOCK=1 — set E2E_SPEECH_MOCK=1 to drive the mic) →
 * six reviewed items → one confirm → six real transactions with correct
 * types and amounts, and category learning recorded for next time.
 */
test("daily recap: one sentence → reviewed list → six real transactions + learning", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile recap flow");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(150_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-recap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "เงินสด", account_type: "cash", currency_code: "THB", opening_balance: "5000.00" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.getByRole("button", { name: /บันทึกด่วน|quick capture/i }).click();
    const box = page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i);
    await expect(box).toBeVisible();
    const mic = page.getByRole("button", { name: /เริ่มพูด|start talking/i });
    await expect(mic).toBeVisible();

    if (process.env.E2E_SPEECH_MOCK === "1") {
      // Tap = latch on; the mock recognizer "hears" the recap; tap again to stop.
      await mic.click();
      await expect(page.getByText(/กำลังฟัง|listening/i).first()).toBeVisible();
      await expect(box).toHaveValue(/แม่ให้ 2,000/, { timeout: 10_000 });
      await page.getByRole("button", { name: /หยุดฟัง|stop listening/i }).click();
    } else {
      await box.fill(RECAP);
      await box.blur();
    }

    await expect(page.getByRole("heading", { name: /พบ 6 รายการ|6 items found/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/จ่าย ฿180/)).toBeVisible();
    await expect(page.getByText(/รับ ฿22,000/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("recap-review-390.png"), fullPage: true });

    // Remove nothing, fix nothing: confirm all six.
    await page.getByRole("button", { name: /ยืนยันบันทึก 6 รายการ|save 6 items/i }).click();
    await expect(page.getByText(/บันทึกแล้ว 6 รายการ|saved 6 items/i)).toBeVisible({ timeout: 30_000 });

    const { data: txs, error } = await admin.from("transactions").select("type, amount, source").eq("user_id", userId);
    expect(error).toBeNull();
    expect(txs).toHaveLength(6);
    const sum = (type: string) => txs!.filter((t) => t.type === type).reduce((total, t) => total + Number(t.amount), 0);
    expect(txs!.filter((t) => t.type === "expense")).toHaveLength(4);
    expect(sum("expense")).toBe(180);
    expect(txs!.filter((t) => t.type === "income")).toHaveLength(2);
    expect(sum("income")).toBe(22_000);

    // Confirmed categories were learned for next time ("ข้าว" → food).
    const { data: prefs } = await admin.from("merchant_category_preferences").select("merchant_normalized").eq("user_id", userId);
    expect(prefs!.map((p) => p.merchant_normalized)).toContain("ข้าว");

    const { data: balance } = await admin.from("accounts").select("current_balance").eq("user_id", userId).single();
    expect(Number(balance!.current_balance)).toBe(5000 - 180 + 22_000);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
