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

  assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);
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
    // next/image rewrites local public URLs through /_next/image in production.
    const nextBestActionArt = page.locator('img[src*="next-best-action.webp"]');
    const monthlyAdviceArt = page.locator('img[src*="monthly-advice.webp"]');
    for (const artwork of [nextBestActionArt, monthlyAdviceArt]) {
      await expect(artwork).toBeVisible();
      await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("ai-coach-art-light-390.png"), fullPage: true });

    await page.getByRole("button", { name: "สลับธีม" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(nextBestActionArt).toBeVisible();
    await expect(monthlyAdviceArt).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("ai-coach-art-dark-390.png"), fullPage: true });

    // Hold the request briefly so the streaming/loading treatment is
    // observable even when the real provider responds almost immediately.
    await page.route("**/api/ai/chat", async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
      await route.continue();
    });
    const input = page.getByLabel("พิมพ์คำถามเกี่ยวกับการเงินของคุณ...");
    const assistantCount = async () =>
      (await admin.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "assistant")).count ?? 0;

    await input.fill("ตอนนี้ฉันมีเงินสดเท่าไหร่");
    await input.press("Enter");
    const readingArt = page.locator('img[src*="reading.webp"]');
    await expect(readingArt).toBeVisible();
    await expect.poll(() => readingArt.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
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

    // The fourth AI artwork explains unfamiliar figures inside the shared
    // info popover. Keep this in the same mobile/dark-mode visual pass.
    expect((await admin.from("assets").insert({ user_id: userId, name: "ทองคำ", asset_type: "gold", value: 42000 })).error).toBeNull();
    await page.goto("/money/assets");
    // Cross-section navigation intentionally keeps its page curl for 650ms.
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "สินทรัพย์คืออะไร" }).click();
    const explainArt = page.locator('img[src*="explain.webp"]');
    await expect(explainArt).toBeVisible();
    await expect.poll(() => explainArt.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("ai-explain-popover-dark-390.png"), fullPage: true });
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
