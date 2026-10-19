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
 * iPhone report (2026-10-19): on จดด้วยเสียง a tap on the blank paper below
 * the hint did nothing — only a long-press reached the text. PR #34 focused on
 * pointerdown and the tap's own mousedown blurred it again. A plain tap in the
 * middle of the empty page must leave the paper focused (on a real iPhone that
 * is what raises the keyboard; emulation can only check the focus).
 */
test("a tap on the blank voice paper focuses the paper", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile tap behaviour");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-voice-tap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

    await page.getByRole("button", { name: "จดรายรับรายจ่ายด้วยเสียง" }).click();
    const paper = page.getByRole("textbox", { name: "ข้อความที่จด แตะเพื่อแก้ไข" });
    await expect(paper).toBeVisible();
    const hint = (await page.getByText("แตะไมค์ด้านล่างเพื่อเริ่มพูด").boundingBox())!;
    const mic = (await page.getByRole("button", { name: "เริ่มพูด" }).boundingBox())!;
    const isPaperFocused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "ข้อความที่จด แตะเพื่อแก้ไข");

    await page.touchscreen.tap(195, Math.round((hint.y + hint.height + mic.y) / 2));
    await expect.poll(isPaperFocused).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("voice-paper-tap-390.png") });

    await paper.blur();
    await page.getByRole("button", { name: "พิมพ์เอง" }).tap();
    await expect.poll(isPaperFocused).toBe(true);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
