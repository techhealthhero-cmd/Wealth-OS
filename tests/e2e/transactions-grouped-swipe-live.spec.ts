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

async function centred(page: Page, text: string) {
  const r = page.getByText(text, { exact: true }).first();
  await r.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  return (await r.boundingBox())!;
}

/**
 * /money/transactions: rows grouped under month → day headings, and swipe
 * left/right to delete with a 5-second undo (same behavior as the inbox).
 */
test("Transactions: month/day headings, swipe to delete, undo", async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile touch flow");
  test.skip(browserName !== "chromium", "Touch is driven through the Chromium DevTools protocol");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(150_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-txgroup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
    const make = (description: string, amount: string, date: string, type = "expense") => ({
      user_id: userId,
      account_id: account!.id,
      type,
      amount,
      transaction_date: date,
      description,
    });
    const { data: inserted, error } = await admin
      .from("transactions")
      .insert([
        make("ไก่ทอดทดสอบ", "20.00", "2026-08-20"),
        make("แม่ให้ทดสอบ", "2000.00", "2026-08-20", "income"),
        make("ไปเที่ยวทดสอบ", "3000.00", "2026-08-19"),
        make("ข้าวกรกฎาทดสอบ", "50.00", "2026-07-05"),
      ])
      .select("id, description");
    expect(error).toBeNull();
    const idOf = (d: string) => inserted!.find((t) => t.description === d)!.id;
    const exists = async (d: string) => (await admin.from("transactions").select("id", { count: "exact", head: true }).eq("id", idOf(d))).count;

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await page.goto("/money/transactions");

    // Month and day headings, newest first.
    await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "กรกฎาคม 2569" })).toBeVisible();
    await expect(page.getByText(/^วันที่ 20(?!\d)/)).toBeVisible();
    await expect(page.getByText(/^วันที่ 19(?!\d)/)).toBeVisible();
    await expect(page.getByText(/^วันที่ 5(?!\d)/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("transactions-grouped-390.png"), fullPage: true });

    const cdp = await page.context().newCDPSession(page);

    // 1) Full swipe LEFT → gone, and deleted after the undo window; the ⋮ menu never opened.
    let box = await centred(page, "ไก่ทอดทดสอบ");
    await touchSwipe(cdp, box.y + box.height / 2, 320, 5);
    await expect(page.getByText("ลบรายการแล้ว")).toBeVisible();
    await expect(page.getByText("ไก่ทอดทดสอบ", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect.poll(() => exists("ไก่ทอดทดสอบ"), { timeout: 12_000 }).toBe(0);

    // 2) Full swipe LEFT, then undo → it comes back and is NOT deleted.
    box = await centred(page, "ไปเที่ยวทดสอบ");
    await touchSwipe(cdp, box.y + box.height / 2, 320, 5);
    await page.getByRole("button", { name: "เลิกทำ" }).click();
    await expect(page.getByText("ไปเที่ยวทดสอบ", { exact: true })).toBeVisible();
    await page.waitForTimeout(6_500);
    expect(await exists("ไปเที่ยวทดสอบ")).toBe(1);

    // 3) Full swipe RIGHT → the edit form opens for THAT row, nothing is deleted.
    box = await centred(page, "แม่ให้ทดสอบ");
    await touchSwipe(cdp, box.y + box.height / 2, box.x + 5, 385);
    const dialog = page.getByRole("dialog", { name: /แก้ไขรายการ/ });
    // The dialog root itself reports as zero-size ("hidden") to Playwright;
    // its content is what's actually on screen.
    const amount = dialog.getByRole("textbox", { name: "จำนวนเงิน" });
    await expect(amount).toBeVisible({ timeout: 10_000 });
    await expect(amount).toHaveValue("2000");
    await page.screenshot({ path: testInfo.outputPath("transactions-swipe-edit-390.png") });
    await expect(page.getByText("ลบรายการแล้ว")).toHaveCount(0);
    expect(await exists("แม่ให้ทดสอบ")).toBe(1);

    // 4) Tapping the dimmed backdrop outside the card CLOSES the form (slides
    //    down), it does not minimize it into the floating "resume" pill.
    await page.touchscreen.tap(195, 40);
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath("form-closing-midway-390.png") });
    await expect(amount).toHaveCount(0, { timeout: 3_000 });
    await expect(page.getByRole("dialog", { name: /แก้ไขรายการ/ })).toHaveCount(0);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
