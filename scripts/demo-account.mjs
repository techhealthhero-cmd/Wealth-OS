#!/usr/bin/env node
/**
 * Creates (or re-creates) a DEMO account filled with fictional data, used to
 * take screenshots of the app for the WEALTH OS story — never real money.
 *
 *   node scripts/demo-account.mjs          # create if missing, else re-seed
 *
 * Same approach as the live e2e specs (tests/e2e/*-live.spec.ts): the
 * service-role admin client from .env.local creates an `@example.com` user.
 * The generated password is written back to .env.local (git-ignored) as
 * DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD; nothing secret is printed.
 * Re-running deletes the demo user (all its rows cascade) and seeds afresh,
 * so dates stay relative to "today".
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(".env.local");
const EMAIL = "wealthos-demo-story@example.com";

function readEnv() {
  const values = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function writeEnvValue(key, value) {
  const text = readFileSync(ENV_PATH, "utf8");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  writeFileSync(ENV_PATH, pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`);
}

const env = readEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function check(result, what) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A date `monthsAgo` months back, on `day` (clamped to today for the current month). */
function day(monthsAgo, dayOfMonth) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dayOfMonth);
  return d > now ? now : d;
}

async function findUserId() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === EMAIL);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  const existing = await findUserId();
  if (existing) {
    check(await admin.auth.admin.deleteUser(existing), "delete previous demo user");
  }

  const password = `Demo-${randomBytes(12).toString("base64url")}`;
  const created = check(
    await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { display_name: "ดาว (บัญชีตัวอย่าง)" },
    }),
    "create demo user"
  );
  const userId = created.user.id;
  writeEnvValue("DEMO_ACCOUNT_EMAIL", EMAIL);
  writeEnvValue("DEMO_ACCOUNT_PASSWORD", password);

  // Profile row comes from the handle_new_user() trigger; finish onboarding.
  check(
    await admin
      .from("profiles")
      .update({ display_name: "ดาว", onboarding_completed: true, preferred_language: "th" })
      .eq("user_id", userId),
    "update profile"
  );

  const cats = check(await admin.from("categories").select("id, name_en, type").eq("is_system", true), "load categories");
  const cat = (name, type) => cats.find((c) => c.name_en === name && (!type || c.type === type))?.id ?? null;

  const [cash, bank, savings] = check(
    await admin
      .from("accounts")
      .insert([
        { user_id: userId, name: "เงินสด", account_type: "cash", currency_code: "THB", opening_balance: 3000 },
        { user_id: userId, name: "กสิกร ออมทรัพย์", account_type: "bank", institution: "KBank", currency_code: "THB", opening_balance: 42000 },
        { user_id: userId, name: "เงินเก็บ (เงินฝากประจำ)", account_type: "savings", institution: "SCB", currency_code: "THB", opening_balance: 60000 },
      ])
      .select("id"),
    "insert accounts"
  );

  const tx = [];
  const add = (monthsAgo, d, type, amount, account, category, description, merchant = null) =>
    tx.push({
      user_id: userId,
      account_id: account.id,
      category_id: category,
      type,
      amount,
      transaction_date: ymd(day(monthsAgo, d)),
      description,
      merchant,
      source: "seed",
    });

  for (const m of [3, 2, 1, 0]) {
    add(m, 1, "income", 35000, bank, cat("Salary", "income"), "เงินเดือน", "บริษัท");
    add(m, 2, "expense", 8500, bank, cat("Housing"), "ค่าเช่าคอนโด", "นิติบุคคล");
    add(m, 3, "expense", 419, bank, cat("Subscriptions"), "Netflix", "Netflix");
    add(m, 3, "expense", 159, bank, cat("Subscriptions"), "Spotify", "Spotify");
    add(m, 5, "expense", 1250, cash, cat("Transport"), "BTS / MRT", "BTS");
    add(m, 6, "expense", 2380, bank, cat("Food & Dining"), "ซื้อของเข้าบ้าน", "Lotus's");
    add(m, 9, "expense", 165, cash, cat("Food & Dining"), "กาแฟ + ขนม", "Café Amazon");
    add(m, 12, "expense", 890, bank, cat("Food & Dining"), "ข้าวเย็นกับเพื่อน", "MK");
    add(m, 15, "income", m === 0 ? 4500 : 6000, bank, cat("Freelance", "income") ?? cat("Other", "income"), "งานออกแบบโลโก้", "ลูกค้า");
    add(m, 18, "expense", 1450, bank, cat("Shopping") ?? cat("Other", "expense"), "รองเท้าวิ่ง", "Shopee");
    add(m, 20, "expense", 2500, bank, cat("Debt Payment") ?? cat("Other", "expense"), "จ่ายบัตรเครดิต", "KBank");
    add(m, 24, "expense", 620, cash, cat("Food & Dining"), "อาหารกลางวัน", null);
  }
  check(await admin.from("transactions").insert(tx), "insert transactions");
  check(
    await admin.from("transactions").insert(
      [3, 2, 1].map((m) => ({
        user_id: userId,
        type: "transfer",
        amount: 5000,
        transaction_date: ymd(day(m, 26)),
        description: "โอนเข้าเงินเก็บ",
        from_account_id: bank.id,
        to_account_id: savings.id,
        source: "seed",
      }))
    ),
    "insert transfers"
  );

  const today = new Date();
  const [, trip] = check(
    await admin
      .from("financial_goals")
      .insert([
        { user_id: userId, name: "เงินสำรองฉุกเฉิน 6 เดือน", goal_type: "emergency_fund", target_amount: 120000, current_amount: 75000, priority: "high", monthly_contribution: 5000, linked_account_id: savings.id },
        { user_id: userId, name: "ทริปญี่ปุ่น", goal_type: "travel", target_amount: 45000, current_amount: 18000, priority: "medium", monthly_contribution: 3000, target_date: ymd(new Date(today.getFullYear() + 1, 3, 1)) },
        { user_id: userId, name: "MacBook ทำงาน", goal_type: "gadget", target_amount: 52000, current_amount: 9000, priority: "low", monthly_contribution: 2000 },
      ])
      .select("id"),
    "insert goals"
  );
  void trip;

  check(
    await admin.from("emergency_funds").insert({
      user_id: userId,
      target_months: 6,
      current_amount: 75000,
      monthly_contribution: 5000,
      linked_account_id: savings.id,
    }),
    "insert emergency fund"
  );

  check(
    await admin.from("liabilities").insert([
      { user_id: userId, name: "บัตรเครดิต KBank", liability_type: "credit_card", balance: 12400, interest_rate: 16, minimum_payment: 1240, due_date: ymd(day(-1, 5)) },
      { user_id: userId, name: "กยศ.", liability_type: "student_loan", balance: 98000, interest_rate: 1, minimum_payment: 1500 },
    ]),
    "insert liabilities"
  );

  check(
    await admin.from("assets").insert([
      { user_id: userId, name: "ทองคำ 1 บาท", asset_type: "gold", value: 42000 },
      { user_id: userId, name: "กองทุน SSF", asset_type: "investment", value: 30000 },
    ]),
    "insert assets"
  );

  const monthStart = ymd(new Date(today.getFullYear(), today.getMonth(), 1));
  const [budget] = check(
    await admin.from("budgets").insert({ user_id: userId, month: monthStart, total_budget: 22000, planned_savings: 5000 }).select("id"),
    "insert budget"
  );
  const budgetLines = [
    [cat("Housing"), 8500, true],
    [cat("Food & Dining"), 6000, true],
    [cat("Transport"), 1500, true],
    [cat("Subscriptions"), 600, false],
    [cat("Shopping") ?? cat("Other", "expense"), 2000, false],
  ].filter(([id]) => id);
  check(
    await admin.from("budget_categories").insert(
      budgetLines.map(([category_id, amount, is_essential]) => ({ budget_id: budget.id, category_id, amount, is_fixed: false, is_essential }))
    ),
    "insert budget lines"
  );

  // Six months of net-worth history so the trend chart has a shape.
  const history = [118000, 124500, 131000, 129500, 137800, 143200];
  check(
    await admin.from("net_worth_snapshots").insert(
      history.map((net, i) => ({
        user_id: userId,
        snapshot_date: ymd(day(history.length - i, 28)),
        total_assets: net + 115000,
        total_liabilities: 115000,
        net_worth: net,
      }))
    ),
    "insert net worth snapshots"
  );

  console.log(`Demo account ready (${EMAIL}); password saved to .env.local as DEMO_ACCOUNT_PASSWORD.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
