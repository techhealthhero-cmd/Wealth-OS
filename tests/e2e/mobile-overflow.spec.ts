import { test, expect, type Page } from "@playwright/test";

/**
 * Mobile horizontal-overflow QA (2026-09 real-device iPhone bug audit).
 *
 * Checks `document.documentElement.scrollWidth <= window.innerWidth + 1` on
 * each route, and — when it fails — reports every element whose
 * `getBoundingClientRect()` extends past the right edge or before the left
 * edge, so a real offending element is identified instead of guessed at.
 * Viewports come from `playwright.config.ts` (320/360/375/390/430/1280).
 *
 * Public routes run unauthenticated, every time. Authenticated routes
 * (`/dashboard`, `/money/*`, `/plan/*`, ...) are skipped unless
 * E2E_TEST_EMAIL and E2E_TEST_PASSWORD are set to a real, disposable
 * account on the target environment (never production credentials — point
 * E2E_BASE_URL at a staging deployment for these). This suite makes no
 * assumption about which account exists; it only logs in with whatever is
 * provided.
 */
async function assertNoHorizontalOverflow(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });

  const result = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const innerWidth = window.innerWidth;
    const offenders: { selector: string; left: number; right: number }[] = [];

    if (scrollWidth > innerWidth + 1) {
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1) {
          const cls = typeof el.className === "string" && el.className ? `.${el.className.split(" ").join(".")}` : "";
          offenders.push({ selector: `${el.tagName.toLowerCase()}${cls}`.slice(0, 160), left: Math.round(r.left), right: Math.round(r.right) });
        }
      });
    }

    return { scrollWidth, innerWidth, offenders: offenders.slice(0, 8) };
  });

  expect(
    result.scrollWidth,
    `${route}: scrollWidth=${result.scrollWidth} > innerWidth=${result.innerWidth}. Offending elements: ${JSON.stringify(result.offenders, null, 2)}`
  ).toBeLessThanOrEqual(result.innerWidth + 1);
}

const PUBLIC_ROUTES = ["/", "/login", "/signup"];

for (const route of PUBLIC_ROUTES) {
  test(`no horizontal overflow: ${route} (public, unauthenticated)`, async ({ page }) => {
    await assertNoHorizontalOverflow(page, route);
  });
}

const AUTHENTICATED_ROUTES = [
  "/dashboard",
  "/money/transactions",
  "/money/accounts",
  "/money/budget",
  "/money/assets",
  "/money/liabilities",
  "/money/net-worth",
  "/money/recurring",
  "/money/subscriptions",
  "/plan/goals",
  "/plan/emergency-fund",
  "/plan/money-year",
  "/plan/debt",
  "/plan/forecast",
  "/earn",
  "/earn/income",
  "/earn/skills",
  "/earn/opportunities",
  "/earn/missions",
  "/ai",
  "/missions",
  "/review",
  "/notifications",
  "/profile",
  "/billing",
  "/pricing",
];

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe("authenticated routes", () => {
  test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (a disposable staging account) to run this suite.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /log ?in|sign ?in|เข้าสู่ระบบ/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  for (const route of AUTHENTICATED_ROUTES) {
    test(`no horizontal overflow: ${route}`, async ({ page }) => {
      await assertNoHorizontalOverflow(page, route);
    });
  }
});
