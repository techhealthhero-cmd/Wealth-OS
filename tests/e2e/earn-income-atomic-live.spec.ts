import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function env(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) result[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function client(key: "SUPABASE_SERVICE_ROLE_KEY" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): SupabaseClient {
  const values = env();
  return createClient(values.NEXT_PUBLIC_SUPABASE_URL, values[key], {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test("record_earn_income is atomic, idempotent and ownership-safe", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop-1280", "Database contract needs one live run");
  const values = env();
  test.skip(!values.SUPABASE_SERVICE_ROLE_KEY, "Service role is required for disposable-user setup and cleanup");
  const admin = client("SUPABASE_SERVICE_ROLE_KEY");
  const userApi = client("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const otherApi = client("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = "TestPassword123!";
  let userA = "";
  let userB = "";

  try {
    const [createdA, createdB] = await Promise.all([
      admin.auth.admin.createUser({ email: `earn-atomic-a-${stamp}@example.com`, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: `earn-atomic-b-${stamp}@example.com`, password, email_confirm: true }),
    ]);
    expect(createdA.error).toBeNull();
    expect(createdB.error).toBeNull();
    userA = createdA.data.user!.id;
    userB = createdB.data.user!.id;

    const { data: accounts, error: accountsError } = await admin.from("accounts").insert([
      { user_id: userA, name: "Atomic A", account_type: "cash", currency_code: "THB", opening_balance: "1000.00" },
      { user_id: userB, name: "Atomic B", account_type: "cash", currency_code: "THB", opening_balance: "9000.00" },
    ]).select("id, user_id");
    expect(accountsError).toBeNull();
    const accountA = accounts!.find((row) => row.user_id === userA)!.id;
    const accountB = accounts!.find((row) => row.user_id === userB)!.id;

    const pathRows = [
      { user_id: userA, path_type: "freelance_service", title: "A main", status: "active", roadmap_template_version: "earn-roadmap-v1", current_roadmap_step_key: "foundation", initialized_at: new Date().toISOString() },
      { user_id: userA, path_type: "business_product", title: "A other", status: "active", roadmap_template_version: "earn-roadmap-v1", current_roadmap_step_key: "problem", initialized_at: new Date().toISOString() },
      { user_id: userB, path_type: "career", title: "B", status: "active", roadmap_template_version: "earn-roadmap-v1", current_roadmap_step_key: "foundation", initialized_at: new Date().toISOString() },
    ];
    const { data: paths, error: pathsError } = await admin.from("income_paths").insert(pathRows).select("id, user_id, title");
    expect(pathsError).toBeNull();
    const pathA = paths!.find((row) => row.title === "A main")!.id;
    const pathAOther = paths!.find((row) => row.title === "A other")!.id;
    const pathB = paths!.find((row) => row.user_id === userB)!.id;
    const { data: projects, error: projectError } = await admin.from("earn_projects").insert([
      { user_id: userA, income_path_id: pathA, title: "A project" },
      { user_id: userA, income_path_id: pathAOther, title: "A wrong-path project" },
      { user_id: userB, income_path_id: pathB, title: "B project" },
    ]).select("id, title");
    expect(projectError).toBeNull();
    const projectA = projects!.find((row) => row.title === "A project")!.id;
    const wrongPathProject = projects!.find((row) => row.title === "A wrong-path project")!.id;
    const projectB = projects!.find((row) => row.title === "B project")!.id;

    expect((await userApi.auth.signInWithPassword({ email: `earn-atomic-a-${stamp}@example.com`, password })).error).toBeNull();
    const base = {
      p_income_path_id: pathA,
      p_earn_project_id: projectA,
      p_account_id: accountA,
      p_category_id: null,
      p_amount: 500,
      p_transaction_date: "2026-10-01",
      p_description: "Atomic QA",
      p_client_request_id: crypto.randomUUID(),
    };

    for (const invalid of [
      { ...base, p_income_path_id: pathB, p_client_request_id: crypto.randomUUID() },
      { ...base, p_earn_project_id: projectB, p_client_request_id: crypto.randomUUID() },
      { ...base, p_earn_project_id: wrongPathProject, p_client_request_id: crypto.randomUUID() },
      { ...base, p_account_id: accountB, p_client_request_id: crypto.randomUUID() },
      { ...base, p_category_id: crypto.randomUUID(), p_client_request_id: crypto.randomUUID() },
      { ...base, p_amount: -1, p_client_request_id: crypto.randomUUID() },
    ]) {
      expect((await userApi.rpc("record_earn_income", invalid)).error).not.toBeNull();
    }
    expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(0);
    expect((await admin.from("earn_transaction_links").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(0);
    expect(Number((await admin.from("accounts").select("current_balance").eq("id", accountA).single()).data!.current_balance)).toBe(1000);

    const first = await userApi.rpc("record_earn_income", base);
    const retry = await userApi.rpc("record_earn_income", base);
    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data).toBe(first.data);
    expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(1);
    expect((await admin.from("earn_transaction_links").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(1);
    expect(Number((await admin.from("accounts").select("current_balance").eq("id", accountA).single()).data!.current_balance)).toBe(1500);

    expect((await otherApi.auth.signInWithPassword({ email: `earn-atomic-b-${stamp}@example.com`, password })).error).toBeNull();
    expect((await otherApi.from("earn_transaction_links").select("id").eq("transaction_id", first.data)).data).toEqual([]);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userA) await admin.auth.admin.deleteUser(userA);
    if (userB) await admin.auth.admin.deleteUser(userB);
    for (const id of [userA, userB].filter(Boolean)) {
      expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", id)).count).toBe(0);
      expect((await admin.from("earn_projects").select("id", { count: "exact", head: true }).eq("user_id", id)).count).toBe(0);
    }
  }
});
