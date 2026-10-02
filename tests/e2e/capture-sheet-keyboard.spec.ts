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
 * iOS overlays the keyboard (only visualViewport shrinks). This fakes that
 * exactly, then checks the jank users reported: typing the first letter
 * adds the preview card and folds the examples away — the sheet's top edge
 * must not move, and the sheet must stay fully above the keyboard.
 */
test("typing with the iOS keyboard up never makes the Quick Capture sheet jump", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Mobile keyboard behaviour");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    let keyboard = 0;
    const events = new EventTarget();
    const fake = {
      get height() {
        return window.innerHeight - keyboard;
      },
      get width() {
        return window.innerWidth;
      },
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, get: () => fake });
    (window as unknown as { __setKeyboard: (h: number) => void }).__setKeyboard = (h: number) => {
      keyboard = h;
      events.dispatchEvent(new Event("resize"));
    };
  });

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "เงินสด", account_type: "cash", currency_code: "THB", opening_balance: "100.00" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.getByRole("button", { name: /บันทึกด่วน|quick capture/i }).click();
    const box = page.getByLabel(/บันทึกรายการแบบพิมพ์|quick entry text/i);
    await expect(box).toBeVisible();
    const sheet = page.locator('[data-slot="sheet-content"]');

    const KEYBOARD = 336; // iPhone 13 Thai keyboard incl. suggestion bar
    await box.focus();
    await page.evaluate((h) => (window as unknown as { __setKeyboard: (h: number) => void }).__setKeyboard(h), KEYBOARD);
    await page.waitForTimeout(450); // let the sheet glide up with the keyboard

    const before = (await sheet.boundingBox())!;
    const viewportHeight = page.viewportSize()!.height;
    expect(before.y + before.height, "sheet sits above the keyboard").toBeLessThanOrEqual(viewportHeight - KEYBOARD + 1);

    await box.pressSequentially("ข้าว", { delay: 40 });
    await page.waitForTimeout(450);
    const afterFirstWord = (await sheet.boundingBox())!;
    await box.pressSequentially(" 80", { delay: 40 });
    await expect(page.getByLabel(/จำนวนเงิน|amount/i)).toHaveValue("80");
    await page.waitForTimeout(300);
    const afterAmount = (await sheet.boundingBox())!;

    for (const [label, box2] of [
      ["after typing the first word", afterFirstWord],
      ["after the amount", afterAmount],
    ] as const) {
      expect(Math.abs(box2.y - before.y), `sheet top stays put ${label}`).toBeLessThanOrEqual(1);
      expect(Math.abs(box2.height - before.height), `sheet height stays put ${label}`).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: testInfo.outputPath("keyboard-typing-390.png") });

    // Keyboard down: the sheet returns to resting at the bottom.
    await page.evaluate(() => (window as unknown as { __setKeyboard: (h: number) => void }).__setKeyboard(0));
    await page.waitForTimeout(450);
    const rested = (await sheet.boundingBox())!;
    expect(Math.round(rested.y + rested.height)).toBeGreaterThanOrEqual(viewportHeight - 2);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
