import { expect, test, type CDPSession, type Page } from "@playwright/test";
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

async function touchSwipe(cdp: CDPSession, y: number, fromX: number, toX: number, steps = 12, stepDelayMs = 25) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + ((toX - fromX) * i) / steps, y }] });
    await new Promise((r) => setTimeout(r, stepDelayMs));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

// Inbox rows only — the undo toast is an <li> too (inside an <ol>).
/** Centre the row first — near the bottom it sits under the fixed nav bar. */
async function centred(page: Page, text: string) {
  const r = row(page, text);
  await r.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
  return (await r.boundingBox())!;
}

const row = (page: Page, text: string) => page.locator("ul > li").filter({ hasText: text }).first();

/**
 * Daily Inbox, iPhone-style: swipe an item away (either direction) to
 * delete it, with a 5-second undo; a short swipe leaves a "ลบ" button; a
 * swipe never presses the row's own ✓.
 */
test("Daily Inbox: swipe to delete, undo, and the tap-to-delete reveal", async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile touch flow");
  test.skip(browserName !== "chromium", "Touch is driven through the Chromium DevTools protocol");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(150_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-swipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    const { data: account } = await admin
      .from("accounts")
      .insert({ user_id: userId, name: "เงินสด", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" })
      .select("id")
      .single();
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // Asia/Bangkok
    const make = (description: string, amount: string) => ({
      user_id: userId,
      account_id: account!.id,
      type: "expense",
      amount,
      transaction_date: today,
      description,
      source: "quick_text",
      review_status: "needs_review",
      ai_confidence: "medium",
    });
    const { data: inserted, error } = await admin
      .from("transactions")
      .insert([make("ไก่ทอดหาดใหญ่", "40.00"), make("แม่ให้ผิด", "80.00"), make("ข้าวซ้ำ", "50.00")])
      .select("id, description");
    expect(error).toBeNull();
    const idOf = (d: string) => inserted!.find((t) => t.description === d)!.id;
    const exists = async (d: string) => (await admin.from("transactions").select("id", { count: "exact", head: true }).eq("id", idOf(d))).count;

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    const cdp = await page.context().newCDPSession(page);

    await expect(page.getByText("ปัดซ้ายเพื่อลบ · ปัดขวาเพื่อแก้ไข", { exact: false })).toBeVisible({ timeout: 20_000 });

    // 1) Full swipe LEFT → gone at once, deleted after the undo window; ✓ was never pressed.
    const first = row(page, "ไก่ทอดหาดใหญ่");
    let box = await centred(page, "ไก่ทอดหาดใหญ่");
    await touchSwipe(cdp, box.y + 40, box.x + box.width - 30, box.x + 20);
    await expect(page.getByText("ลบรายการแล้ว")).toBeVisible();
    await expect(first).toHaveCount(0);
    await expect.poll(() => exists("ไก่ทอดหาดใหญ่"), { timeout: 12_000 }).toBe(0);
    const { data: stillPending } = await admin.from("transactions").select("review_status").eq("id", idOf("แม่ให้ผิด")).single();
    expect(stillPending!.review_status).toBe("needs_review");

    // 2) Full swipe LEFT, then undo → it comes back and is NOT deleted.
    box = await centred(page, "แม่ให้ผิด");
    await touchSwipe(cdp, box.y + 40, box.x + box.width - 30, box.x + 20);
    await page.getByRole("button", { name: "เลิกทำ" }).click();
    await expect(row(page, "แม่ให้ผิด")).toBeVisible();
    await page.waitForTimeout(6_500);
    expect(await exists("แม่ให้ผิด")).toBe(1);

    // 2b) Full swipe RIGHT → that item's edit form opens; nothing is deleted.
    box = await centred(page, "แม่ให้ผิด");
    await touchSwipe(cdp, box.y + 40, box.x + 20, box.x + box.width - 20);
    const amount = page.getByRole("dialog", { name: /แก้ไขรายการ/ }).getByRole("textbox", { name: "จำนวนเงิน" });
    await expect(amount).toBeVisible({ timeout: 10_000 });
    await expect(amount).toHaveValue("80");
    await page.screenshot({ path: testInfo.outputPath("inbox-swipe-edit-390.png") });
    await page.getByRole("button", { name: "ปิด" }).first().click();
    await expect(amount).toHaveCount(0);
    await expect(page.getByText("ลบรายการแล้ว")).toHaveCount(0);
    expect(await exists("แม่ให้ผิด")).toBe(1);

    // 3) Short swipe → the red "ลบ" stays open; tapping it deletes.
    box = await centred(page, "ข้าวซ้ำ");
    await touchSwipe(cdp, box.y + 40, box.x + box.width - 40, box.x + box.width - 140, 10, 40);
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath("inbox-swipe-reveal-390.png") });
    await page.touchscreen.tap(box.x + box.width - 40, box.y + 40);
    await expect(row(page, "ข้าวซ้ำ")).toHaveCount(0);
    await expect.poll(() => exists("ข้าวซ้ำ"), { timeout: 12_000 }).toBe(0);

    // 4) Outside the inbox rows, the app-wide swipe still switches tabs (Home → Money).
    const month = page.getByText("เดือนนี้", { exact: true }).first();
    await month.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(250);
    const m = (await month.boundingBox())!;
    await touchSwipe(cdp, m.y + m.height / 2, 330, 40);
    await page.waitForURL(/\/money/, { timeout: 10_000 });
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
