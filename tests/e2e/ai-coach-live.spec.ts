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
 * AI Money Coach end to end (real API, a few satang): two messages in one
 * conversation stream back, are saved, and each logs exactly one usage row
 * on the chat quota. Covers the prompt-caching / thinking-off request shape
 * the provider now sends — the real API rejects a malformed one.
 */
test("AI Coach: two-turn chat streams, saves, and logs chat usage", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "One mobile run is enough");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY || !env.AI_API_KEY, "Disposable cleanup and configured AI are required");
  test.setTimeout(180_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-coach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "เงินสด", account_type: "cash", currency_code: "THB", opening_balance: "12000.00" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/ai");
    const input = page.getByLabel("พิมพ์คำถามเกี่ยวกับการเงินของคุณ...");
    const assistantCount = async () =>
      (await admin.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "assistant")).count ?? 0;

    await input.fill("ตอนนี้ฉันมีเงินสดเท่าไหร่");
    await input.press("Enter");
    await expect.poll(assistantCount, { timeout: 60_000 }).toBe(1);
    await expect(input).toBeEnabled({ timeout: 30_000 });

    await input.fill("ควรเก็บเงินสำรองเท่าไหร่ดี ตอบสั้น ๆ");
    await input.press("Enter");
    await expect.poll(assistantCount, { timeout: 60_000 }).toBe(2);

    const { data: replies } = await admin.from("ai_messages").select("content").eq("user_id", userId).eq("role", "assistant");
    for (const r of replies!) expect(r.content.trim().length).toBeGreaterThan(10);
    // The first answer knows the real balance (฿12,000) — fetched data, not invented.
    expect(replies!.some((r) => /12,000/.test(r.content))).toBe(true);
    await expect(page.getByRole("log").getByText(/12,000/).first()).toBeVisible();

    // One usage row per message, on the chat quota (feature column once 0037 is applied).
    const { data: usage, error } = await admin.from("ai_usage_log").select("*").eq("user_id", userId);
    expect(error).toBeNull();
    expect(usage).toHaveLength(2);
    for (const row of usage!) if ("feature" in row) expect(row.feature).toBe("chat");
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
