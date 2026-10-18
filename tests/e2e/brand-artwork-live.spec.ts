import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function expectArtworkLoaded(artwork: Locator) {
  await expect(artwork).toBeVisible();
  await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test("Landing, onboarding-adjacent auth screens and link preview show the brand artwork", async ({ page }, testInfo) => {
  test.skip(!["iphone-375", "desktop-1280"].includes(testInfo.project.name), "One phone and one desktop pass");

  await page.goto("/");
  const planner = page.locator('img[src*="planner-cutout.webp"]');
  await expectArtworkLoaded(planner);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("landing.png"), fullPage: true });
  // The cut-out sits straight on the page, so check it on the dark paper too.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectArtworkLoaded(planner);
  await page.screenshot({ path: testInfo.outputPath("landing-dark.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "light" });

  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expectArtworkLoaded(page.locator('img[src*="preview.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${path.slice(1)}.png`), fullPage: true });
  }

  const og = await page.request.get("/opengraph-image");
  expect(og.ok()).toBe(true);
  expect(og.headers()["content-type"]).toContain("image/png");
  await testInfo.attach("opengraph-image", { body: await og.body(), contentType: "image/png" });
  await page.goto("/opengraph-image");
  await page.screenshot({ path: testInfo.outputPath("opengraph-image.png") });
});

test("Help shows the journey map and the what's-new sticker in light and dark", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-375", "One mobile visual pass is enough");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-brand-art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/help");
    await expect(page.locator(".page-curl-sheet")).toHaveCount(0);
    await expectArtworkLoaded(page.locator('img[src*="journey.webp"]'));
    await expectArtworkLoaded(page.locator('img[src*="announcement.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("help-light.png") });

    await page.getByRole("button", { name: /toggle theme|สลับธีม/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectArtworkLoaded(page.locator('img[src*="journey.webp"]'));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("help-dark.png") });
    await page.getByRole("button", { name: /toggle theme|สลับธีม/i }).click();
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
