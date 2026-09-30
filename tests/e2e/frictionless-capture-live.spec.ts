import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeMerchant } from "@/lib/capture/transaction-parser";

function localEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function adminClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function openCapture(page: Page) {
  await page.getByRole("button", { name: /บันทึกด่วน|quick capture/i }).click();
  await expect(page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i)).toBeVisible();
}

async function saveTextCapture(page: Page, text: string) {
  await openCapture(page);
  await page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i).fill(text);
  await expect(page.getByLabel(/จำนวนเงิน|amount/i)).toHaveValue(/\d+/, { timeout: 10_000 });
  await page.getByRole("button", { name: /^(บันทึก|save)\s+฿/i }).click();
  await expect(page.getByText(/บันทึกแล้ว|saved/i).last()).toBeVisible({ timeout: 15_000 });
}

test("signed-in capture V1: deterministic, AI fallback, Inbox learning, recurring and scanner fixture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "One disposable-user run is sufficient; responsive capture coverage exists separately");
  test.setTimeout(150_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY || !env.AI_API_KEY, "Disposable cleanup and configured AI are required");
  const admin = adminClient();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-capture-${stamp}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Capture QA" } });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true }).eq("user_id", userId)).error).toBeNull();
    const { data: account, error: accountError } = await admin.from("accounts").insert({
      user_id: userId,
      name: "KBank",
      account_type: "bank",
      institution: "Kasikorn",
      currency_code: "THB",
      opening_balance: "10000.00",
    }).select("id").single();
    expect(accountError).toBeNull();
    // Two previous occurrences make the next Netflix capture a suggestion,
    // never an automatically-created future transaction.
    expect((await admin.from("transactions").insert([
      { user_id: userId, account_id: account!.id, type: "expense", amount: "419", transaction_date: "2026-07-30", merchant: "Netflix", source: "manual" },
      { user_id: userId, account_id: account!.id, type: "expense", amount: "419", transaction_date: "2026-08-30", merchant: "Netflix", source: "manual" },
    ])).error).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    // Quick Capture is the raised center action in the mobile bottom nav;
    // desktop intentionally exposes the detailed Quick Add menu instead.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    // Deterministic path: zero AI usage.
    const beforeSimple = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0;
    await saveTextCapture(page, "Grab 145");
    expect((await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(beforeSimple);

    // Hybrid path: exactly one AI request, then the same preview/save path.
    await openCapture(page);
    await page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i).fill("เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji จ่ายไป 1280 จากกสิกร");
    await expect.poll(async () => (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0, { timeout: 30_000 }).toBe(beforeSimple + 1);
    await expect(page.getByText(/AI ช่วยอ่าน|AI helped read/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^(บันทึก|save)\s+฿/i }).click();
    await expect(page.getByText(/บันทึกแล้ว|saved/i).last()).toBeVisible({ timeout: 15_000 });

    // Unknown merchant enters the existing Daily Inbox; a category correction
    // confirms it and teaches the existing merchant preference table.
    const merchant = `ร้านทดสอบ ${stamp}`;
    await saveTextCapture(page, `${merchant} 99`);
    await page.reload();
    await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 15_000 });
    const inboxItem = page.getByText(merchant).first().locator("xpath=ancestor::li");
    await inboxItem.getByRole("button", { name: /เปลี่ยนหมวด|change category/i }).click();
    await inboxItem.getByRole("radio", { name: /อาหาร|food/i }).click();
    const learnedKey = normalizeMerchant(merchant);
    await expect.poll(async () => (await admin.from("merchant_category_preferences").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("merchant_normalized", learnedKey)).count ?? 0).toBe(1);

    // The learned preference is used on the next capture and no longer lands
    // as an undecided Other category.
    await saveTextCapture(page, `${merchant} 109`);
    const { data: learnedRows } = await admin.from("transactions").select("review_status, merchant").eq("user_id", userId).eq("merchant", merchant).order("created_at", { ascending: false }).limit(1);
    expect(learnedRows?.[0]?.review_status).toBe("confirmed");

    await openCapture(page);
    await page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i).fill("Netflix 419");
    await page.getByRole("button", { name: /^(บันทึก|save)\s+฿/i }).click();
    await expect(page.getByText(/รายการนี้ดูเหมือนเกิดขึ้นเป็นประจำ|looks like a recurring expense/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /ไม่ใช่|not recurring/i }).click();
    expect((await admin.from("recurring_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);

    // Safe fixture uses the explicit mock parser: scanner transport, preview,
    // review routing and save are real; image interpretation is not claimed.
    await openCapture(page);
    const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3h8AAAAASUVORK5CYII=", "base64");
    await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles({ name: "safe-fixture.png", mimeType: "image/png", buffer: onePixelPng });
    await expect(page.getByText(/ข้อมูลตัวอย่าง|test data|mock/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^(ถูกต้อง|looks right)\s+฿/i }).click();
    await expect.poll(async () => (await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "receipt")).count ?? 0).toBe(1);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (userId) {
      expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
      expect((await admin.from("merchant_category_preferences").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
      expect((await admin.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
    }
  }
});
