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

async function installPerformanceObservers(page: Page) {
  await page.addInitScript(() => {
    const metrics = {
      longTasks: [] as number[],
      layoutShifts: [] as number[],
    };
    Object.defineProperty(window, "__wealthPerf", { value: metrics, configurable: true });

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.longTasks.push(entry.duration);
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) metrics.layoutShifts.push(shift.value ?? 0);
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // WebKit does not expose every observer type. Navigation and scroll
      // timings below remain useful there, while Chromium supplies these.
    }
  });
}

async function scrollMetrics(page: Page) {
  return page.evaluate(async () => {
    const frameDeltas: number[] = [];
    let previous = performance.now();
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    for (let step = 0; step <= 60; step += 1) {
      scrollTo(0, (max * step) / 60);
      await new Promise<void>((resolveFrame) =>
        requestAnimationFrame((now) => {
          frameDeltas.push(now - previous);
          previous = now;
          resolveFrame();
        })
      );
    }
    const sorted = [...frameDeltas].sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    return {
      frameP50Ms: percentile(0.5),
      frameP95Ms: percentile(0.95),
      framesOver25Ms: frameDeltas.filter((value) => value > 25).length,
      framesOver50Ms: frameDeltas.filter((value) => value > 50).length,
    };
  });
}

test("iPhone performance regression: long list, interaction, navigation, and back navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Representative iPhone-sized run");
  test.setTimeout(180_000);

  const env = localEnv();
  test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required for disposable-user cleanup");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-perf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  await installPerformanceObservers(page);

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    expect(
      (await admin.from("profiles").update({ onboarding_completed: true, preferred_language: "th" }).eq("user_id", userId))
        .error
    ).toBeNull();
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({ user_id: userId, name: "Performance", account_type: "cash", currency_code: "THB", opening_balance: "100000.00" })
      .select("id")
      .single();
    expect(accountError).toBeNull();

    const rows = Array.from({ length: 151 }, (_, index) => ({
      user_id: userId,
      account_id: account!.id,
      type: index % 5 === 0 ? "income" : "expense",
      amount: `${(index % 23) + 1}.00`,
      transaction_date: `2026-${String(1 + (index % 9)).padStart(2, "0")}-${String(1 + (index % 27)).padStart(2, "0")}`,
      description: `performance row ${index + 1}`,
    }));
    expect((await admin.from("transactions").insert(rows)).error).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/email|อีเมล/i).fill(email);
    await page.getByLabel(/password|รหัสผ่าน/i).fill(password);
    await page.getByRole("button", { name: /^(log in|เข้าสู่ระบบ)$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    const cacheBoundary = await page.evaluate(async () => {
      const registrations = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
      const response = await fetch("/api/app-version", { cache: "no-store" });
      return {
        serviceWorkerCount: registrations.length,
        cacheControl: response.headers.get("cache-control") ?? "",
        largeDashboardChunks: (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .filter((entry) => entry.name.includes("/_next/static/chunks/") && entry.decodedBodySize > 300 * 1024)
          .map((entry) => new URL(entry.name).pathname),
      };
    });
    expect(cacheBoundary.serviceWorkerCount).toBe(0);
    expect(cacheBoundary.cacheControl).toContain("no-store");
    expect(cacheBoundary.largeDashboardChunks).toEqual([]);

    const navigationStart = performance.now();
    await page.goto("/money/transactions", { waitUntil: "domcontentloaded" });
    const transactionsReadyMs = performance.now() - navigationStart;
    await expect(page.getByText("performance row 151", { exact: true })).toBeVisible({ timeout: 20_000 });

    const scroll = await scrollMetrics(page);
    const captureStart = performance.now();
    await page.locator("[data-fab-trigger]").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    const quickCaptureOpenMs = performance.now() - captureStart;
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });

    const routeStart = performance.now();
    await page.locator('a[href="/dashboard"]').last().click();
    await page.waitForURL(/\/dashboard/);
    await page.locator("main").waitFor({ state: "visible" });
    await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame())));
    const routeToDashboardMs = performance.now() - routeStart;

    const backStart = performance.now();
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("performance row 151", { exact: true })).toBeVisible({ timeout: 20_000 });
    const backToTransactionsMs = performance.now() - backStart;

    const browserMetrics = await page.evaluate(() => {
      const metrics = (window as Window & { __wealthPerf?: { longTasks: number[]; layoutShifts: number[] } }).__wealthPerf;
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const scripts = performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/_next/static/chunks/")) as PerformanceResourceTiming[];
      return {
        longTaskCount: metrics?.longTasks.length ?? 0,
        maxLongTaskMs: Math.max(0, ...(metrics?.longTasks ?? [])),
        cumulativeLayoutShift: (metrics?.layoutShifts ?? []).reduce((sum, value) => sum + value, 0),
        transferredKB: Math.round((navigation?.transferSize ?? 0) / 1024),
        scriptCount: scripts.length,
        scriptTransferKB: Math.round(scripts.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024),
        scriptDecodedKB: Math.round(scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0) / 1024),
      };
    });

    console.log(
      `IPHONE_PERF ${JSON.stringify({ transactionsReadyMs, quickCaptureOpenMs, routeToDashboardMs, backToTransactionsMs, ...scroll, ...browserMetrics, largeDashboardChunks: cacheBoundary.largeDashboardChunks })}`
    );
  } finally {
    await page.close().catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
