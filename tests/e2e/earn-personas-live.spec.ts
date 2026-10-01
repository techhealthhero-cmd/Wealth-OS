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

const STEP: Record<string, { key: string; title: string; expected: string }> = {
  career: { key: "foundation", title: "stored-copy", expected: "Write down one target job" },
  freelance_service: { key: "foundation", title: "stored-copy", expected: "Choose one service you can offer" },
  business_product: { key: "problem", title: "stored-copy", expected: "Write down one customer problem" },
  investment: { key: "foundation", title: "stored-copy", expected: "Check your emergency buffer first" },
};

test("Earn V2 persona states render deterministic next actions", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  test.skip(testInfo.project.name !== "desktop-1280", "Persona state matrix needs one live run");
  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "Service role is required for disposable-user setup and cleanup");
  const admin = adminClient();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `earn-personas-${stamp}@example.com`;
  const password = "TestPassword123!";
  let userId = "";
  let assessmentIndex = 0;

  const assessment = async (situation: string, incomeMinor: number, steady: boolean | null, expensesMinor = 1_000_000) => {
    assessmentIndex += 1;
    const answers = {
      incomeSituation: situation,
      monthlyIncomeMinor: incomeMinor,
      incomeIsSteady: steady,
      essentialExpensesMinor: expensesMinor,
      availableResources: ["smartphone", "computer", "internet"],
      workPreferences: ["digital"],
      existingAbilities: ["tech"],
      availableHoursPerWeek: 8,
      startingCapitalMinor: 0,
      startingCapitalCurrency: "THB",
      currentPriority: incomeMinor === 0 ? "quick_money" : "increase_income",
    };
    const result = await admin.from("earn_assessments").insert({
      user_id: userId,
      rules_version: "e2e-persona-v1",
      answers,
      calculated_stage: incomeMinor === 0 ? "survive" : incomeMinor < expensesMinor ? "cashflow" : "stability",
      reason_codes: [incomeMinor === 0 ? "no_income_for_basic_needs" : incomeMinor < expensesMinor ? "income_below_essential_expenses" : "essential_expenses_covered"],
      essential_expenses_amount: expensesMinor / 100,
      essential_expenses_currency: "THB",
      essential_expenses_source: "self_report",
      completed_at: new Date(Date.now() + assessmentIndex * 1000).toISOString(),
    });
    expect(result.error).toBeNull();
  };

  const paths = async (items: { type: keyof typeof STEP; title: string }[]) => {
    expect((await admin.from("income_missions").delete().eq("user_id", userId)).error).toBeNull();
    expect((await admin.from("income_paths").delete().eq("user_id", userId)).error).toBeNull();
    for (const item of items) {
      const step = STEP[item.type];
      const { data: path, error: pathError } = await admin.from("income_paths").insert({
        user_id: userId,
        path_type: item.type,
        title: item.title,
        status: "active",
        roadmap_template_version: "earn-roadmap-v1",
        current_roadmap_step_key: step.key,
        initialized_at: new Date().toISOString(),
      }).select("id").single();
      expect(pathError).toBeNull();
      expect((await admin.from("income_missions").insert({
        user_id: userId,
        income_path_id: path!.id,
        title: step.title,
        mission_type: "other",
        mission_category: "learn",
        roadmap_step_key: step.key,
        status: "not_started",
        result_required: false,
        sequence_order: 1,
      })).error).toBeNull();
    }
  };

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect((await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "en" }).eq("user_id", userId)).error).toBeNull();
    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Zero income: no path means one clear choice rather than a fabricated mission.
    await assessment("none", 0, null);
    await paths([]);
    await page.goto("/earn");
    await expect(page.getByRole("heading", { name: "Choose your first income path" })).toBeVisible();

    // Irregular income / freelance.
    await assessment("freelance", 500_000, false);
    await paths([{ type: "freelance_service", title: "Irregular freelance" }]);
    await page.goto("/earn");
    await expect(page.getByRole("heading", { name: STEP.freelance_service.expected })).toBeVisible();

    // Salaried career.
    await assessment("salary", 3_000_000, null);
    await paths([{ type: "career", title: "Career growth" }]);
    await page.goto("/earn");
    await expect(page.getByRole("heading", { name: STEP.career.expected })).toBeVisible();

    // Business/product.
    await assessment("business", 1_500_000, true);
    await paths([{ type: "business_product", title: "Small product" }]);
    await page.goto("/earn");
    await expect(page.getByRole("heading", { name: STEP.business_product.expected })).toBeVisible();

    // Investment remains a planning path, not buy/sell advice.
    await assessment("salary", 3_000_000, null);
    await paths([{ type: "investment", title: "Long-term plan" }]);
    await page.goto("/earn");
    await expect(page.getByRole("heading", { name: STEP.investment.expected })).toBeVisible();
    const { data: investmentPath } = await admin.from("income_paths").select("id").eq("user_id", userId).single();
    await page.goto(`/earn/paths/${investmentPath!.id}`);
    await expect(page.getByText(/planning only/i)).toBeVisible();

    // Multiple paths are simultaneously visible; the engine still chooses one primary action.
    await paths([
      { type: "career", title: "Primary career" },
      { type: "freelance_service", title: "Weekend freelance" },
    ]);
    await page.goto("/earn");
    await expect(page.getByText("Primary career")).toBeVisible();
    await expect(page.getByText("Weekend freelance")).toBeVisible();
    await expect(page.locator("#earn-next-action")).toHaveCount(1);

    // Returning user: assessment history is preserved and latest snapshot drives guidance.
    await assessment("salary", 3_500_000, null);
    await page.goto("/earn");
    await expect(page.getByText("Primary career")).toBeVisible();
    expect((await admin.from("earn_assessments").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBeGreaterThan(1);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (userId) {
      expect((await admin.from("earn_assessments").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
      expect((await admin.from("income_paths").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
    }
  }
});
