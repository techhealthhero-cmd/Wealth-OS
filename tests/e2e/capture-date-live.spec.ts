import { expect, test, type CDPSession } from "@playwright/test";
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

async function touchDrag(cdp: CDPSession, x: number, fromY: number, toY: number, steps = 14, stepDelayMs = 35) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: fromY + ((toY - fromY) * i) / steps }] });
    await new Promise((r) => setTimeout(r, stepDelayMs));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/**
 * Catching up on an earlier day: open the date wheel, swipe DOWN to go back,
 * and what's captured is saved on that day — without the swipe closing the
 * sheet. A full-day recap uses the picked day for every item too.
 */
test("Quick Capture: swipe the date wheel back, save on that day", async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile touch flow");
  test.skip(browserName !== "chromium", "Touch is driven through the Chromium DevTools protocol");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(150_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "เงินสด", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    const cdp = await page.context().newCDPSession(page);

    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

    await page.getByRole("button", { name: /บันทึกด่วน|quick capture/i }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    const pill = page.getByRole("button", { name: /วันที่บันทึก: วันนี้/ });
    await expect(pill).toBeVisible();
    await pill.click();
    const wheel = page.getByRole("listbox", { name: "วันที่บันทึก" });
    await expect(wheel).toBeVisible();
    await expect(wheel.getByRole("option", { selected: true })).toHaveText("วันนี้");

    // Swipe DOWN on the wheel: earlier days roll into the centre.
    const box = (await wheel.boundingBox())!;
    await touchDrag(cdp, box.x + box.width / 2, box.y + 40, box.y + 40 + 88);
    await page.waitForTimeout(700);
    await expect(sheet, "a swipe on the wheel never closes the sheet").toBeVisible();
    const pickedId = await wheel.getByRole("option", { selected: true }).getAttribute("id");
    const picked = pickedId!.replace("capture-date-", "");
    expect(picked < today, `picked ${picked} is before today ${today}`).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("date-wheel-390.png") });
    await page.getByRole("button", { name: "เสร็จ", exact: true }).click();
    await expect(page.getByRole("button", { name: /^วันที่บันทึก: (?!วันนี้)/ })).toBeVisible();

    // One item on the picked day.
    const entry = page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i);
    await entry.fill("ข้าว 50");
    await page.getByRole("button", { name: /^(บันทึก|save)\s+฿/i }).click();
    await expect.poll(async () => (await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0).toBe(1);
    const { data: single } = await admin.from("transactions").select("transaction_date").eq("user_id", userId).single();
    expect(single!.transaction_date).toBe(picked);

    // Reopening starts back at today.
    await page.getByRole("button", { name: /บันทึกด่วน|quick capture/i }).click();
    await expect(page.getByRole("button", { name: /วันที่บันทึก: วันนี้/ })).toBeVisible();

    // A recap on a picked day: every item lands on it (via the calendar this time).
    await page.getByRole("button", { name: /วันที่บันทึก/ }).click();
    await page.getByLabel("หรือเลือกจากปฏิทิน").fill(picked);
    await page.getByRole("button", { name: "เสร็จ", exact: true }).click();
    await entry.fill("น้ำ 10 ขนม 20");
    await page.getByRole("button", { name: /ยืนยันบันทึก 2 รายการ/ }).click();
    await expect.poll(async () => (await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0).toBe(3);
    const { data: all } = await admin.from("transactions").select("transaction_date").eq("user_id", userId);
    expect(all!.every((t) => t.transaction_date === picked)).toBe(true);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
