// Temporary script: verifies RLS on every Day 2 table using two real,
// disposable users. Deleted before this task finishes.
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.argv[2] ?? "https://lvxuruzspchhcwebrbzy.supabase.co";
const ANON_KEY = process.argv[3];

if (!ANON_KEY) {
  console.error("Usage: node _rls_test.mjs <supabase-url> <anon-key>");
  process.exit(1);
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
}

async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`signup failed: ${JSON.stringify(data)}`);
  return { userId: data.user.id, accessToken: data.access_token };
}

function rest(path, { method = "GET", token, body } = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal,count=exact",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const suffix = Date.now();
const userA = await signUp(`wealthos-rls-a-${suffix}@mailinator.com`, "TestPassword123!");
const userB = await signUp(`wealthos-rls-b-${suffix}@mailinator.com`, "TestPassword123!");
console.log("Created test users:", userA.userId, userB.userId);

// Fetch a system category to use for budget_categories.
const catRes = await rest("categories?is_system=eq.true&limit=1", { token: userA.accessToken });
const [systemCategory] = await catRes.json();

async function testTable(table, insertPayload) {
  const createRes = await rest(table, { method: "POST", token: userA.accessToken, body: insertPayload });
  const created = await createRes.json();
  if (!createRes.ok) {
    record(`${table}: setup insert as user A`, false, JSON.stringify(created));
    return;
  }
  const row = Array.isArray(created) ? created[0] : created;
  record(`${table}: user A can create their own row`, Boolean(row?.id ?? row?.transaction_id ?? true));

  const rowId = row.id;

  // User B: SELECT must return zero rows for A's data.
  const selectRes = await rest(`${table}?id=eq.${rowId}`, { token: userB.accessToken });
  const selected = await selectRes.json();
  record(`${table}: user B cannot SELECT user A's row`, Array.isArray(selected) && selected.length === 0, `got ${JSON.stringify(selected)}`);

  // User B: UPDATE must affect zero rows.
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${rowId}`, {
    method: "PATCH",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${userB.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(table === "assets" ? { name: "hacked" } : { notes: "hacked" }),
  });
  const updated = await updateRes.json().catch(() => []);
  record(`${table}: user B cannot UPDATE user A's row`, Array.isArray(updated) && updated.length === 0, `status ${updateRes.status}`);

  // User B: DELETE must affect zero rows.
  const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${rowId}`, {
    method: "DELETE",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${userB.accessToken}`,
      Prefer: "return=representation",
    },
  });
  const deleted = await deleteRes.json().catch(() => []);
  record(`${table}: user B cannot DELETE user A's row`, Array.isArray(deleted) && deleted.length === 0, `status ${deleteRes.status}`);

  // User B: INSERT claiming user_id = A must be rejected.
  if ("user_id" in insertPayload) {
    const spoofRes = await rest(table, {
      method: "POST",
      token: userB.accessToken,
      body: { ...insertPayload, user_id: userA.userId },
    });
    const spoofBody = await spoofRes.json().catch(() => null);
    record(`${table}: user B cannot INSERT claiming user A's user_id`, !spoofRes.ok, `status ${spoofRes.status} ${JSON.stringify(spoofBody)}`);
  }
}

await testTable("assets", { user_id: userA.userId, name: `RLS Test Asset ${randomUUID()}`, asset_type: "cash", value: 100 });
await testTable("liabilities", { user_id: userA.userId, name: `RLS Test Liability ${randomUUID()}`, liability_type: "credit_card", balance: 100 });
await testTable("financial_goals", { user_id: userA.userId, name: `RLS Test Goal ${randomUUID()}`, goal_type: "custom", target_amount: 1000 });
await testTable("net_worth_snapshots", { user_id: userA.userId, snapshot_date: "2025-01-15", total_assets: 100, total_liabilities: 0, net_worth: 100 });
await testTable("emergency_funds", { user_id: userA.userId, target_months: 6 });
await testTable("wealth_scores", {
  user_id: userA.userId,
  total_score: 50,
  cash_flow_score: 50,
  savings_score: 50,
  emergency_fund_score: 50,
  debt_health_score: 50,
  net_worth_growth_score: 50,
  income_growth_score: 50,
  goal_progress_score: 50,
});

// budgets (needed as the parent for budget_categories)
const budgetRes = await rest("budgets", {
  method: "POST",
  token: userA.accessToken,
  body: { user_id: userA.userId, month: "2025-02-01", total_budget: 5000 },
});
const [budgetRow] = await budgetRes.json();
record("budgets: user A can create their own row", Boolean(budgetRow?.id));

const selBudgetAsB = await rest(`budgets?id=eq.${budgetRow.id}`, { token: userB.accessToken });
const selBudgetAsBJson = await selBudgetAsB.json();
record("budgets: user B cannot SELECT user A's row", selBudgetAsBJson.length === 0);

if (systemCategory) {
  const bcRes = await rest("budget_categories", {
    method: "POST",
    token: userA.accessToken,
    body: { budget_id: budgetRow.id, category_id: systemCategory.id, amount: 500 },
  });
  const [bcRow] = await bcRes.json();
  record("budget_categories: user A can create via their own budget", Boolean(bcRow?.id));

  const bcAsB = await rest(`budget_categories?id=eq.${bcRow.id}`, { token: userB.accessToken });
  const bcAsBJson = await bcAsB.json();
  record("budget_categories: user B cannot SELECT user A's row", bcAsBJson.length === 0);

  const bcInsertAsB = await rest("budget_categories", {
    method: "POST",
    token: userB.accessToken,
    body: { budget_id: budgetRow.id, category_id: systemCategory.id, amount: 999 },
  });
  record("budget_categories: user B cannot INSERT into user A's budget", !bcInsertAsB.ok);
} else {
  record("budget_categories: skipped (no system category found)", false);
}

console.log("\n=== SUMMARY ===");
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("FAILURES:");
  failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
}
