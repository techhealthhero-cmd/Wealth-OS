import { expect, test, type Page } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

async function collectRuntimeErrors(page: Page, route: string) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response, `${route} should return a document response`).not.toBeNull();
  expect(response!.status(), `${route} returned ${response!.status()}`).toBeLessThan(500);
  expect(errors, `${route} emitted browser runtime errors`).toEqual([]);
}

for (const route of PUBLIC_PAGES) {
  test(`public page is healthy: ${route}`, async ({ page }) => {
    await collectRuntimeErrors(page, route);
  });
}

test("protected page redirects an anonymous visitor to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("protected APIs reject anonymous requests", async ({ request }) => {
  const [history, transactions] = await Promise.all([
    request.get("/api/ai/history"),
    request.get("/api/export/transactions"),
  ]);

  expect(history.status()).toBe(401);
  expect(transactions.status()).toBe(401);
});

test("web metadata endpoints are available", async ({ request }) => {
  const [robots, sitemap, manifest] = await Promise.all([
    request.get("/robots.txt"),
    request.get("/sitemap.xml"),
    request.get("/manifest.webmanifest"),
  ]);

  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("User-Agent");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
});
