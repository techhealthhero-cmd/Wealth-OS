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

/** A real finger drag through Chromium's touch pipeline (native scrolling included). */
async function touchDrag(cdp: CDPSession, x: number, fromY: number, toY: number, steps = 12, stepDelayMs = 16) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
  for (let i = 1; i <= steps; i++) {
    const y = fromY + ((toY - fromY) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await new Promise((r) => setTimeout(r, stepDelayMs));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const sheet = (page: Page) => page.locator('[data-slot="sheet-content"]');
const scroller = (page: Page) => sheet(page).locator(".overflow-y-auto").first();

async function openCapture(page: Page) {
  await page.getByRole("button", { name: /บันทึกด่วน|quick capture/i }).click();
  await expect(page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i)).toBeVisible();
  await page.waitForTimeout(400); // opening transition
}

test("Quick Capture sheet moves freely: scrolls, drops the keyboard, expands, collapses and closes by swipe", async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Touch gestures are verified on the mobile project");
  test.skip(browserName !== "chromium", "Touch is driven through the Chromium DevTools protocol");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(120_000);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true }).eq("user_id", userId)).error).toBeNull();
    expect(
      (
        await admin.from("accounts").insert({ user_id: userId, name: "Cash", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" })
      ).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // A short screen forces the sheet's content to overflow.
    await page.setViewportSize({ width: 390, height: 560 });
    const cdp = await page.context().newCDPSession(page);
    await openCapture(page);
    // A typed entry adds the review card, like a real capture in progress.
    await page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i).fill("ข้าว 80");
    await expect(page.getByLabel(/จำนวนเงิน|amount/i)).toHaveValue(/80/, { timeout: 10_000 });
    await page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i).blur();
    await page.waitForTimeout(300);

    const box = (await sheet(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const overflow = await scroller(page).evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow, "content should overflow on a short screen").toBeGreaterThan(20);

    // 1) Swipe up on the content → it scrolls; the sheet does not move or close.
    await touchDrag(cdp, x, box.y + box.height - 60, box.y + 140);
    await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(sheet(page)).toBeVisible();

    // 2) Swipe down while scrolled → scrolls back toward the top, still open.
    await touchDrag(cdp, x, box.y + 160, box.y + box.height - 40);
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeVisible();

    // 3) Keyboard up: a downward swipe drops the keyboard (blurs the field)
    //    instead of closing anything — Instagram-chat style.
    const entry = page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i);
    await entry.focus();
    await expect(entry).toBeFocused();
    await touchDrag(cdp, x, box.y + 200, box.y + 320);
    await expect(entry).not.toBeFocused();
    await expect(sheet(page)).toBeVisible();

    // 4) On a taller screen the window itself moves: pull the header up to
    //    expand to near full height, pull it down to shrink back.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const resting = (await sheet(page).boundingBox())!;
    await touchDrag(cdp, x, resting.y + 30, resting.y - 280);
    await page.waitForTimeout(350);
    const tall = (await sheet(page).boundingBox())!;
    expect(tall.height, "pulled up, the sheet expands").toBeGreaterThan(resting.height + 150);
    await touchDrag(cdp, x, tall.y + 30, tall.y + 260);
    await page.waitForTimeout(450);
    const back = (await sheet(page).boundingBox())!;
    expect(Math.abs(back.height - resting.height), "pulled down, it returns to its resting size").toBeLessThan(12);
    await expect(sheet(page)).toBeVisible();

    // 5) A small, slow pull springs back and stays open.
    await touchDrag(cdp, x, back.y + 30, back.y + 70, 10, 40);
    await page.waitForTimeout(350);
    await expect(sheet(page)).toBeVisible();
    expect(await sheet(page).evaluate((el) => el.style.transform)).toBe("");

    // 6) A long pull down from the header closes the sheet.
    await touchDrag(cdp, x, back.y + 30, back.y + 330);
    await expect(sheet(page)).toHaveCount(0, { timeout: 5_000 });

    // 7) Reopening starts at rest, and pulling down from the top of the
    //    (unscrolled) content also closes it.
    await openCapture(page);
    expect(await sheet(page).evaluate((el) => el.style.transform)).toBe("");
    await page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i).blur();
    const box2 = (await sheet(page).boundingBox())!;
    await touchDrag(cdp, x, box2.y + 150, box2.y + 460);
    await expect(sheet(page)).toHaveCount(0, { timeout: 5_000 });
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
