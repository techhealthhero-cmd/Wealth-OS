import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

function adminClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, context: string) {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth, context).toBeLessThanOrEqual(dimensions.width + 1);
}

/**
 * Permanent Earn V2 core-loop regression. It uses a disposable user and the
 * real signed-in UI, then verifies the resulting database relationships.
 * Deleting the auth user cascades every fixture created by this test.
 */
test("Earn V2 core loop: diagnostic → path → mission → result → project → income", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "desktop-1280", "One disposable-user run covers the live core loop");

  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  const admin = adminClient();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-earn-${stamp}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Earn V2 QA" },
    });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect(
      (
        await admin
          .from("profiles")
          .update({ onboarding_completed: true, preferred_language: "en" })
          .eq("user_id", userId)
      ).error
    ).toBeNull();
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({ user_id: userId, name: "Earn QA Cash", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" })
      .select("id")
      .single();
    expect(accountError).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto("/earn/diagnostic");
    await page.getByRole("radio", { name: "No income yet" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Essential expenses per month (THB)").fill("8000");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Computer / laptop" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Computer work" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Computers / tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("radio", { name: "5–10 hours" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("radio", { name: "None" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("radio", { name: "I need money soon" }).click();
    await page.getByRole("button", { name: "See results" }).click();
    await page.waitForURL(/\/earn\/diagnostic\/result/, { timeout: 20_000 });

    const { data: assessments } = await admin.from("earn_assessments").select("id, calculated_stage").eq("user_id", userId);
    expect(assessments).toHaveLength(1);
    expect(assessments![0].calculated_stage).toBe("survive");

    await page.goto("/earn/paths/new");
    await page.getByRole("radio", { name: /Freelance/ }).click();
    await page.getByLabel("Name the goal of this path").fill("QA website service");
    await page.getByRole("button", { name: "Start this path" }).click();
    await page.waitForURL(/\/earn\/paths\/[0-9a-f-]+$/, { timeout: 20_000 });
    const pathId = page.url().split("/").pop()!;

    await expect(page.getByText("Choose one service you can offer")).toBeVisible();
    await page.getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByText("Make one sample of your work")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Mark done" }).click();
    await page.waitForURL(/\/earn\/missions\/[0-9a-f-]+\/result/, { timeout: 20_000 });
    await page.getByRole("textbox", { name: "Samples finished", exact: true }).fill("1");
    await page.getByRole("button", { name: "Save result" }).click();
    await page.waitForURL(new RegExp(`/earn/paths/${pathId}$`), { timeout: 20_000 });
    await expect(page.getByText("Find 5 potential customers")).toBeVisible();

    await page.getByRole("button", { name: "Add project" }).click();
    await page.getByLabel("Project name").fill("Restaurant website");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText("Restaurant website")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Record real income" }).click();
    await page.getByLabel("Amount").fill("500");
    await page.getByLabel("Description (optional)").fill("QA deposit");
    await page.getByRole("button", { name: "Record income" }).click();
    await page.waitForURL(new RegExp(`/earn/paths/${pathId}$`), { timeout: 20_000 });
    await expect(page.getByText(/฿500\.00/)).toBeVisible();

    const { data: paths } = await admin.from("income_paths").select("id, current_roadmap_step_key").eq("user_id", userId);
    expect(paths).toEqual([expect.objectContaining({ id: pathId, current_roadmap_step_key: "find_leads" })]);
    const { data: projects } = await admin.from("earn_projects").select("id, status").eq("user_id", userId);
    expect(projects).toEqual([expect.objectContaining({ status: "active" })]);
    const { data: links } = await admin.from("earn_transaction_links").select("transaction_id, income_path_id").eq("user_id", userId);
    expect(links).toEqual([expect.objectContaining({ income_path_id: pathId })]);
    const { data: transaction } = await admin.from("transactions").select("account_id, amount, type").eq("id", links![0].transaction_id).single();
    expect(transaction).toMatchObject({ account_id: account!.id, type: "income" });
    expect(Number(transaction!.amount)).toBe(500);
    const { data: updatedAccount } = await admin.from("accounts").select("current_balance").eq("id", account!.id).single();
    expect(Number(updatedAccount!.current_balance)).toBe(1500);

    // The Hub's decision hierarchy stays readable and overflow-free from the
    // narrowest supported phone through desktop. Screenshots are retained as
    // Playwright artifacts for release-review rather than committed fixtures.
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 700 ? 850 : 900 });
      await page.goto("/earn");
      await expect(page.locator("#earn-next-action")).toBeVisible();
      await expect(page.locator("#earn-roadmap")).toBeVisible();
      await expectNoHorizontalOverflow(page, `Earn Hub overflow at ${width}px`);
      await page.screenshot({ path: testInfo.outputPath(`earn-hub-${width}.png`), fullPage: true });
    }

    // The path's densest page remains usable from a 320px phone through desktop.
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 700 ? 850 : 900 });
      await page.goto(`/earn/paths/${pathId}`);
      await expect(page.getByText("Find 5 potential customers")).toBeVisible();
      await expectNoHorizontalOverflow(page, `Earn path overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/earn", "/earn/missions", "/earn/skills", "/earn/opportunities"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page, `Earn route overflow: ${route}`);
    }

    // Earn uses the existing Privacy Center planning scope; privacy changes
    // presentation only and must never alter the ledger underneath.
    const signedIn = userClient();
    expect((await signedIn.auth.signInWithPassword({ email, password })).error).toBeNull();
    const privacy = await signedIn.rpc("configure_account_privacy", {
      p_enabled: true,
      p_protect_accounts: false,
      p_protect_assets: false,
      p_protect_overview: false,
      p_protect_activity: false,
      p_protect_planning: true,
      p_protect_insights: false,
      p_display_style: "unavailable",
      p_custom_message: null,
      p_pin: "726194",
    });
    expect(privacy.error).toBeNull();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/earn");
    await expect(page.getByText("This information is unavailable")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/฿500\.00/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page, "Privacy-locked Earn Hub overflow");
    await page.screenshot({ path: testInfo.outputPath("earn-hub-privacy-390.png"), fullPage: true });
    await page.goto(`/earn/paths/${pathId}`);
    await expect(page.getByText("••••")).toBeVisible({ timeout: 20_000 });
    expect(Number((await admin.from("accounts").select("current_balance").eq("id", account!.id).single()).data!.current_balance)).toBe(1500);

    // Thai is the primary product language; verify its longer labels wrap
    // naturally in the privacy-locked mobile Hub without widening the page.
    expect((await admin.from("profiles").update({ preferred_language: "th" }).eq("user_id", userId)).error).toBeNull();
    await page.goto("/earn");
    await expect(page.getByText("วันนี้ทำอะไรดี?")).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page, "Thai Earn Hub overflow at 390px");
    await page.screenshot({ path: testInfo.outputPath("earn-hub-thai-390.png"), fullPage: true });
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (userId) {
      expect((await admin.from("earn_assessments").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
      expect((await admin.from("income_paths").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
      expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
    }
  }
});
