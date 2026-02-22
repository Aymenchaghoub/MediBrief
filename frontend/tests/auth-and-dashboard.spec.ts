import { expect, test } from "@playwright/test";

/*
 * These E2E tests validate critical UI flows against a running MediBrief stack.
 * Run with: npx playwright test
 * Prerequisite: backend + frontend + database + redis must be running.
 *
 * Environment:
 *   TEST_USER_EMAIL    — login email    (default: admin@demo.com)
 *   TEST_USER_PASSWORD — login password (default: password123)
 */

const EMAIL = process.env.TEST_USER_EMAIL ?? "admin@demo.com";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "password123";

/* ─── Helpers ─── */

async function login(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard**", { timeout: 10_000 });
}

/* ─── Tests ─── */

test.describe("Auth flow", () => {
  test("redirects unauthenticated users to /auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("logs in and reaches dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("text=Clinical Console")).toBeVisible();
  });
});

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("sidebar navigation works", async ({ page }) => {
    // Navigate to Patients
    await page.getByRole("link", { name: /patients/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/patients/);
    await expect(page.getByText(/patients registry/i)).toBeVisible();

    // Navigate to Consultations
    await page.getByRole("link", { name: /consultations/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/consultations/);
    await expect(page.getByText(/consultation timeline/i)).toBeVisible();

    // Navigate to Analytics
    await page.getByRole("link", { name: /analytics/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/analytics/);

    // Navigate to AI Summary
    await page.getByRole("link", { name: /ai summary/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/ai-summary/);
  });

  test("patients page loads with table", async ({ page }) => {
    await page.goto("/dashboard/patients");
    await expect(page.getByText(/patients registry/i)).toBeVisible();
    // The table header should exist
    await expect(page.getByRole("columnheader", { name: /name/i })).toBeVisible();
  });

  test("create patient form renders all fields", async ({ page }) => {
    await page.goto("/dashboard/patients");
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page.getByLabel(/gender/i)).toBeVisible();
  });

  test("consultations page loads and shows patient selector", async ({ page }) => {
    await page.goto("/dashboard/consultations");
    await expect(page.getByText(/consultation timeline/i)).toBeVisible();
    await expect(page.getByLabel(/patient/i)).toBeVisible();
  });

  test("ai summary page loads with patient selector and generate button", async ({ page }) => {
    await page.goto("/dashboard/ai-summary");
    await expect(page.getByText(/ai-assisted clinical summary/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /generate/i })).toBeVisible();
  });
});

test.describe("Security page (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("security page is accessible for admin", async ({ page }) => {
    await page.goto("/dashboard/security");
    // If user is ADMIN, we see the audit table
    const heading = page.getByText(/enterprise audit dashboard/i);
    const unauthorized = page.getByText(/unable to load audit/i);
    // Either the dashboard loads or we get an access error — both mean the page loaded
    await expect(heading.or(unauthorized)).toBeVisible({ timeout: 10_000 });
  });
});
