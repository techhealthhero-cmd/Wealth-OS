import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function localEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
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

test("signed-in CSV import: mapping, preview, idempotency, RLS, privacy and rollback", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop-1280", "One disposable-user run exercises desktop plus all mobile widths");

  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  const admin = adminClient();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `e2e-import-a-${stamp}@example.com`;
  const emailB = `e2e-import-b-${stamp}@example.com`;
  const password = "TestPassword123!";
  let userA = "";
  let userB = "";

  try {
    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true, user_metadata: { display_name: "Import QA A" } });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true, user_metadata: { display_name: "Import QA B" } });
    expect(createdA.error).toBeNull();
    expect(createdB.error).toBeNull();
    userA = createdA.data.user!.id;
    userB = createdB.data.user!.id;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ onboarding_completed: true })
      .in("user_id", [userA, userB]);
    expect(profileError).toBeNull();

    const { data: accounts, error: accountError } = await admin.from("accounts").insert([
      { user_id: userA, name: "Cash", account_type: "cash", currency_code: "THB", opening_balance: "5000.00" },
      { user_id: userA, name: "KBank", account_type: "bank", institution: "Kasikorn", currency_code: "THB", opening_balance: "10000.00" },
    ]).select("id, name");
    expect(accountError).toBeNull();
    const kbankId = accounts!.find((account) => account.name === "KBank")!.id;
    const { data: manual, error: manualError } = await admin.from("transactions").insert({
      user_id: userA,
      account_id: kbankId,
      type: "expense",
      amount: "100.00",
      currency_code: "THB",
      transaction_date: "2026-09-04",
      merchant: "Existing merchant",
      reference: `EXIST-${stamp}`,
      source: "manual",
    }).select("id").single();
    expect(manualError).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(emailA);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/money/import");
    await expect(page.getByTestId("statement-import-flow")).toBeVisible();
    const csv = [
      "date,description,amount,type,reference,currency",
      `2026-09-01,เงินเดือน,2500,income,SAL-${stamp},THB`,
      `2026-09-02,ข้าว,80,expense,FOOD-${stamp},THB`,
      `2026-09-03,Unknown English,120,expense,UNK-${stamp},THB`,
      `2026-09-04,Existing merchant,100,expense,EXIST-${stamp},THB`,
    ].join("\r\n");
    await page.getByLabel(/นำเข้าไปยังบัญชี|import into account/i).selectOption({ label: "KBank · THB" });
    await page.getByLabel(/เลือกไฟล์รายการเดินบัญชี|choose statement file/i).setInputFiles({
      name: "controlled-statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    const uploadStarted = Date.now();
    await page.getByRole("button", { name: /อ่านไฟล์ CSV|read CSV/i }).click();
    await expect(page.getByText(/จับคู่คอลัมน์|map columns/i)).toBeVisible({ timeout: 20_000 });
    const uploadMs = Date.now() - uploadStarted;

    await page.setViewportSize({ width: 375, height: 812 });
    const prepareStarted = Date.now();
    await page.getByRole("button", { name: /สร้างตัวอย่าง|build preview/i }).click();
    await expect(page.getByText(/ตรวจสอบก่อนนำเข้า|review before import/i)).toBeVisible({ timeout: 20_000 });
    const previewMs = Date.now() - prepareStarted;
    await expect(page.getByTestId("import-row-duplicate")).toHaveCount(1);
    await expect(page.getByTestId("import-row-needs_review")).toHaveCount(1);

    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 850 });
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(dimensions.scroll, `preview overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }

    const confirmStarted = Date.now();
    await page.getByRole("button", { name: /ยืนยันการนำเข้า|confirm import/i }).click();
    await expect(page.getByText(/นำเข้าเสร็จแล้ว|import complete/i)).toBeVisible({ timeout: 20_000 });
    const confirmMs = Date.now() - confirmStarted;
    console.log(`[IMPORT_PERF] rows=4 upload_ms=${uploadMs} preview_ms=${previewMs} confirm_ms=${confirmMs}`);

    const { data: batches } = await admin.from("transaction_import_batches").select("*").eq("user_id", userA).eq("filename", "controlled-statement.csv").order("created_at");
    expect(batches).toHaveLength(1);
    const originalBatch = batches![0];
    expect(originalBatch).toMatchObject({ status: "confirmed", imported_count: 3, skipped_count: 1, review_count: 1, error_count: 0 });
    const { data: imported } = await admin.from("transactions").select("id, review_status, reference").eq("user_id", userA).eq("source", "import");
    expect(imported).toHaveLength(3);
    expect(imported!.filter((row) => row.review_status === "needs_review")).toHaveLength(1);
    const { data: afterImportAccount } = await admin.from("accounts").select("current_balance").eq("id", kbankId).single();
    expect(Number(afterImportAccount!.current_balance)).toBe(12_200);

    // Cross-user reads/writes are denied by RLS.
    const clientB = userClient();
    expect((await clientB.auth.signInWithPassword({ email: emailB, password })).error).toBeNull();
    const crossRead = await clientB.from("transaction_import_batches").select("id").eq("id", originalBatch.id);
    expect(crossRead.data).toEqual([]);
    const crossRow = await clientB.from("transaction_import_rows").insert({
      user_id: userB,
      batch_id: originalBatch.id,
      row_number: 99,
      raw_data: { bad: "cross-user" },
    });
    expect(crossRow.error).not.toBeNull();

    // Same file again: all rows are detected/skipped before confirmation.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/money/import");
    await page.getByLabel(/นำเข้าไปยังบัญชี|import into account/i).selectOption({ label: "KBank · THB" });
    await page.getByLabel(/เลือกไฟล์รายการเดินบัญชี|choose statement file/i).setInputFiles({ name: "controlled-statement.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
    await page.getByRole("button", { name: /อ่านไฟล์ CSV|read CSV/i }).click();
    await page.getByRole("button", { name: /สร้างตัวอย่าง|build preview/i }).click();
    await expect(page.getByTestId("import-row-duplicate")).toHaveCount(4, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /ยืนยันการนำเข้า|confirm import/i })).toBeDisabled();
    expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userA).eq("source", "import")).count).toBe(3);

    // Roll back the original confirmed batch. The pre-existing manual row survives.
    await page.goto(`/money/import?batch=${originalBatch.id}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /ยกเลิกการนำเข้าครั้งนี้|undo this import/i }).click();
    await expect(page.getByText(/ยกเลิกการนำเข้าแล้ว|import rolled back/i)).toBeVisible({ timeout: 20_000 });
    expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userA).eq("source", "import")).count).toBe(0);
    expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("id", manual!.id)).count).toBe(1);
    const { data: afterRollbackAccount } = await admin.from("accounts").select("current_balance").eq("id", kbankId).single();
    expect(Number(afterRollbackAccount!.current_balance)).toBe(9_900);

    // Privacy Center protects the import route using the existing activity/account scopes.
    const clientA = userClient();
    expect((await clientA.auth.signInWithPassword({ email: emailA, password })).error).toBeNull();
    const privacy = await clientA.rpc("configure_account_privacy", {
      p_enabled: true,
      p_protect_accounts: true,
      p_protect_assets: false,
      p_protect_overview: false,
      p_protect_activity: true,
      p_protect_planning: false,
      p_protect_insights: false,
      p_display_style: "unavailable",
      p_custom_message: null,
      p_pin: "726194",
    });
    expect(privacy.error).toBeNull();
    await page.goto("/money/import");
    await expect(page.getByText(/ข้อมูล.*ไม่พร้อมใช้งาน|data.*unavailable/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("statement-import-flow")).toHaveCount(0);
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userA) await admin.auth.admin.deleteUser(userA);
    if (userB) await admin.auth.admin.deleteUser(userB);
    if (userA) {
      expect((await admin.from("transaction_import_batches").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(0);
      expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(0);
      expect((await admin.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userA)).count).toBe(0);
    }
  }
});
