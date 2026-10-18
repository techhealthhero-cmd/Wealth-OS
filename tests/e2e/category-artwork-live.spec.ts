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

test("category artwork: full set, sizes and interactive states at 390px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "One mobile visual pass is enough");
  test.setTimeout(120_000);
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");

  assertStagingSupabase(env.NEXT_PUBLIC_SUPABASE_URL);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-category-art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "en" }).eq("user_id", userId)).error).toBeNull();
    expect(
      (await admin.from("accounts").insert({ user_id: userId, name: "Cash", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" })).error
    ).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await page.goto("/money/transactions");
    await page.getByRole("button", { name: /quick add|เพิ่มรายการ/i }).first().click();
    await page.getByRole("menuitem", { name: /expense|รายจ่าย/i }).click();

    const categories = page.getByRole("radiogroup", { name: /category|หมวดหมู่/i });
    await expect(categories).toBeVisible();
    await categories.getByRole("button", { name: /view all(?: categories)?|ดูหมวดหมู่ทั้งหมด/i }).click();
    const stickers = categories.locator('img[src*="categories"]');
    await expect(stickers).toHaveCount(14);
    await expect.poll(() => stickers.evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    const artworkSources = new Set(await stickers.evaluateAll((images: HTMLImageElement[]) => images.map((image) => image.src)));

    const food = categories.getByRole("radio", { name: /food/i });
    const transport = categories.getByRole("radio", { name: /transport/i });
    await expect(food.locator("img")).toHaveCSS("width", "32px");
    await transport.hover();
    await page.screenshot({ path: testInfo.outputPath("category-art-normal-hover-32-light-390.png"), fullPage: true });

    const transportBox = await transport.boundingBox();
    expect(transportBox).not.toBeNull();
    await page.mouse.move(transportBox!.x + transportBox!.width / 2, transportBox!.y + transportBox!.height / 2);
    await page.mouse.down();
    await page.screenshot({ path: testInfo.outputPath("category-art-pressed-32-light-390.png"), fullPage: true });
    await page.mouse.up();

    await food.click();
    await expect(food).toHaveAttribute("aria-checked", "true");
    await expect(food.locator("[data-category-selected-marker]")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("category-art-selected-32-light-390.png"), fullPage: true });

    await transport.evaluate((button: HTMLButtonElement) => {
      button.disabled = true;
    });
    await expect(transport).toBeDisabled();
    await expect(transport).toHaveCSS("opacity", "0.5");
    await page.screenshot({ path: testInfo.outputPath("category-art-disabled-32-light-390.png"), fullPage: true });

    const foodImage = food.locator("img");
    for (const size of [40, 48]) {
      await foodImage.evaluate((image: HTMLImageElement, pixels) => {
        image.style.width = `${pixels}px`;
        image.style.height = `${pixels}px`;
      }, size);
      await expect(foodImage).toHaveCSS("width", `${size}px`);
      await page.screenshot({ path: testInfo.outputPath(`category-art-selected-${size}-light-390.png`), fullPage: true });
    }

    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("category-art-selected-48-dark-390.png"), fullPage: true });

    await page.getByLabel(/type|ประเภท/i).click();
    await page.getByRole("option", { name: /income|รายรับ/i }).click();
    await expect(stickers).toHaveCount(9);
    await expect.poll(() => stickers.evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    for (const source of await stickers.evaluateAll((images: HTMLImageElement[]) => images.map((image) => image.src))) {
      artworkSources.add(source);
    }
    expect(artworkSources.size).toBe(21);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
