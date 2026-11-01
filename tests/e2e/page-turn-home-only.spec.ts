import { assertStagingSupabase } from "../../scripts/lib/assert-staging-supabase.mjs";
import { expect, test, type Page } from "@playwright/test";
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

async function watchCurl(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __curlSeen?: boolean; __curlWatch?: boolean };
    if (w.__curlWatch) return;
    w.__curlWatch = true;
    w.__curlSeen = false;
    new MutationObserver(() => {
      if (document.querySelector(".page-curl-sheet")) w.__curlSeen = true;
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function resetCurl(page: Page) {
  await watchCurl(page);
  await page.evaluate(() => {
    (window as Window & { __curlSeen?: boolean }).__curlSeen = false;
  });
}

async function curlSeen(page: Page) {
  return page.evaluate(
    () =>
      Boolean((window as Window & { __curlSeen?: boolean }).__curlSeen) ||
      Boolean(document.querySelector(".page-curl-sheet"))
  );
}

async function expectNoCurl(page: Page, url: RegExp, go: () => Promise<void>) {
  await resetCurl(page);
  await go();
  await page.waitForURL(url, { waitUntil: "commit", timeout: 20_000 });
  await page.waitForTimeout(450);
  expect(await curlSeen(page), `curl sheet appeared while waiting for ${url}`).toBe(false);
  await expect(page.locator(".page-curl-sheet")).toHaveCount(0);
}

/**
 * WebKit in this Playwright build rejects `new Touch()`, and a mouse drag
 * does not become a touch. Dispatch a touch-shaped event on the journal
 * page; the app only reads `touches` / `changedTouches`.
 */
async function swipeJournal(page: Page, direction: "next" | "prev") {
  const turned = await page.evaluate((dir) => {
    const el = document.querySelector<HTMLElement>("[data-page-turn]");
    if (!el) return "missing";
    const rect = el.getBoundingClientRect();
    const y = Math.min(rect.top + 240, window.innerHeight - 160);
    const fromX = dir === "next" ? rect.left + rect.width * 0.86 : rect.left + rect.width * 0.16;
    const toX = dir === "next" ? rect.left + rect.width * 0.08 : rect.left + rect.width * 0.88;
    const fire = (type: string, x: number) => {
      const touch = { identifier: 1, clientX: x, clientY: y, target: el };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === "touchend" ? [] : [touch] },
        targetTouches: { value: type === "touchend" ? [] : [touch] },
        changedTouches: { value: [touch] },
      });
      el.dispatchEvent(event);
    };
    fire("touchstart", fromX);
    const steps = 8;
    for (let i = 1; i <= steps; i += 1) fire("touchmove", fromX + ((toX - fromX) * i) / steps);
    fire("touchend", toX);
    return "ok";
  }, direction);
  expect(turned).toBe("ok");
}

test("page curl stays on Home; other routes and tabs do not curl", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "One 390×844 pass is enough");
  test.skip(testInfo.project.use.browserName !== "webkit", "This check is the WebKit pass");
  test.setTimeout(180_000);
  const viewport = page.viewportSize();
  expect(viewport).toEqual({ width: 390, height: 844 });

  const env = localEnv();
  const reuseEmail = process.env.E2E_TEST_EMAIL;
  const reusePassword = process.env.E2E_TEST_PASSWORD;
  const canCreate = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  test.skip(!canCreate && !(reuseEmail && reusePassword), "Need a service role or E2E_TEST_EMAIL/E2E_TEST_PASSWORD");
  if (env.NEXT_PUBLIC_SUPABASE_URL) assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);

  const admin = canCreate
    ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
  const email = reuseEmail || `e2e-page-turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = reusePassword || "TestPassword123!";
  let userId = "";

  try {
    if (admin) {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(created.error).toBeNull();
      userId = created.data.user!.id;
      expect(
        (
          await admin
            .from("profiles")
            .update({
              onboarding_completed: true,
              preferred_language: "th",
              display_name: "เทส",
              notebook_opening_mode: "off",
            })
            .eq("user_id", userId)
        ).error
      ).toBeNull();
    }

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await watchCurl(page);
    await expect(page.locator(".nb-open")).toHaveCount(0);
    await expect(page.locator("[data-page-turn='curl']")).toBeVisible();

    const primary = page.getByRole("navigation", { name: "Primary" });
    await expectNoCurl(page, /\/money\/transactions/, () => primary.getByRole("link", { name: "การเงิน" }).click());
    await expect(page.locator("[data-page-turn='fade']")).toBeVisible();
    await expect(page.getByText("พลิกมุม")).toHaveCount(0);

    await expectNoCurl(page, /\/money\/accounts/, () => page.getByRole("link", { name: "บัญชี", exact: true }).click());
    await expectNoCurl(page, /\/money\/import/, () => page.getByRole("link", { name: "นำเข้า CSV", exact: true }).click());
    await expectNoCurl(page, /\/money\/transactions/, () => page.getByRole("link", { name: "รายการ", exact: true }).click());

    await resetCurl(page);
    await page.getByRole("button", { name: "เดือนก่อน" }).click();
    await page.waitForURL(/month=/);
    await page.waitForTimeout(450);
    expect(await curlSeen(page)).toBe(false);
    await expect(page.getByText("พลิกมุมกระดาษ")).toHaveCount(0);

    await resetCurl(page);
    await swipeJournal(page, "next");
    await page.waitForURL(/\/money\/accounts/, { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(450);
    expect(await curlSeen(page), "swiping between Money tabs curled the page").toBe(false);

    await expectNoCurl(page, /\/plan\/goals/, () => primary.getByRole("link", { name: "วางแผน" }).click());
    await expect(page.locator("[data-page-turn='fade']")).toBeVisible();
    await expectNoCurl(page, /\/plan\/emergency-fund/, () => page.getByRole("link", { name: "เงินสำรองฉุกเฉิน", exact: true }).click());

    await resetCurl(page);
    await swipeJournal(page, "next");
    await page.waitForURL(/\/plan\/money-year/, { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(450);
    expect(await curlSeen(page), "swiping between Plan tabs curled the page").toBe(false);

    await expectNoCurl(page, /\/earn/, () => primary.getByRole("link", { name: "หารายได้" }).click());
    await expect(page.locator("[data-page-turn='fade']")).toBeVisible();
    await expectNoCurl(page, /\/earn\/missions/, () => page.getByRole("link", { name: "ภารกิจ", exact: true }).click());
    await expectNoCurl(page, /\/earn\/income/, () => page.getByRole("link", { name: "รายได้", exact: true }).click());

    await page.locator("header").getByRole("button").last().click();
    await expectNoCurl(page, /\/profile/, () => page.getByRole("menuitem", { name: "ตั้งค่า" }).click());
    await expect(page.locator(".page-curl-sheet")).toHaveCount(0);
    await expect(page.locator("[data-page-turn='curl']")).toHaveCount(0);

    await expectNoCurl(page, /\/dashboard/, () => primary.getByRole("link", { name: "หน้าแรก" }).click());
    await expect(page.locator("[data-page-turn='curl']")).toBeVisible();

    await resetCurl(page);
    await swipeJournal(page, "next");
    await expect.poll(() => curlSeen(page), { timeout: 3_000 }).toBe(true);
    await expect(page.locator(".page-curl-sheet").first()).toBeVisible();

    await page.goto("/dashboard");
    await watchCurl(page);
    await expect(page.locator("[data-page-turn='curl']")).toBeVisible();
    await swipeJournal(page, "prev");
    await expect(page.locator('.nb-open[data-direction="close"]')).toBeVisible({ timeout: 5_000 });
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId && admin) await admin.auth.admin.deleteUser(userId);
  }
});
