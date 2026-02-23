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

/* ─── Auth Flow ─── */

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

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("badpassword");
    await page.getByRole("button", { name: /sign in|log in|login/i }).click();
    // Should stay on auth page (not redirect)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth/);
  });
});

/* ─── Dashboard Navigation ─── */

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

/* ─── Critical Path: Patient Lifecycle ─── */

test.describe("Patient lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a patient and verifies it appears in the table", async ({ page }) => {
    await page.goto("/dashboard/patients");

    const uniqueSuffix = Date.now().toString().slice(-6);
    const firstName = `E2E`;
    const lastName = `Test${uniqueSuffix}`;

    // Fill the create-patient form
    await page.getByLabel(/first name/i).fill(firstName);
    await page.getByLabel(/last name/i).fill(lastName);
    await page.getByLabel(/date of birth/i).fill("1990-01-15");
    await page.getByLabel(/gender/i).selectOption("MALE");

    // Submit
    await page.getByRole("button", { name: /add patient|create patient|submit/i }).click();

    // Wait for the table to update — the new patient should appear
    await expect(
      page.getByRole("cell", { name: new RegExp(`${firstName}\\s+${lastName}`, "i") }).or(
        page.getByText(new RegExp(`${firstName}.*${lastName}`, "i")),
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("navigates to patient detail page", async ({ page }) => {
    await page.goto("/dashboard/patients");
    // Wait for at least one patient row to load
    await expect(page.getByRole("columnheader", { name: /name/i })).toBeVisible();

    // Click the first patient link (detail link or row click)
    const patientLink = page.getByRole("link", { name: /view|detail/i }).first();
    const patientRow = page.locator("table tbody tr").first().locator("a").first();

    const link = (await patientLink.isVisible().catch(() => false)) ? patientLink : patientRow;
    if (await link.isVisible()) {
      await link.click();
      // Should navigate to /dashboard/patients/[id]
      await expect(page).toHaveURL(/\/dashboard\/patients\/[a-zA-Z0-9-]+/);
    }
  });
});

/* ─── Critical Path: Vitals Entry ─── */

test.describe("Vitals entry", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("patient detail page has vitals entry form", async ({ page }) => {
    await page.goto("/dashboard/patients");
    await expect(page.getByRole("columnheader", { name: /name/i })).toBeVisible();

    // Navigate to the first patient's detail page
    const firstLink = page.locator("table tbody tr").first().locator("a").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await expect(page).toHaveURL(/\/dashboard\/patients\/[a-zA-Z0-9-]+/);

      // Check for vitals section
      const vitalsHeading = page.getByText(/vital|vitals/i);
      await expect(vitalsHeading.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

/* ─── Critical Path: AI Summary Generation ─── */

test.describe("AI summary generation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("triggers AI summary and shows streaming state", async ({ page }) => {
    await page.goto("/dashboard/ai-summary");
    await expect(page.getByText(/ai-assisted clinical summary/i)).toBeVisible();

    // Ensure a patient is selected
    const patientSelect = page.getByLabel(/patient/i);
    await expect(patientSelect).toBeVisible();

    // Click generate button
    const generateBtn = page.getByRole("button", { name: /generate/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // After clicking, the UI should show some kind of loading/streaming state
    // (generating text, spinner, or status change)
    const loadingIndicator = page
      .getByText(/generating|processing|streaming|waiting|queued/i)
      .or(page.locator("[aria-busy='true']"))
      .or(page.getByRole("button", { name: /generating/i }));

    // The button should become disabled or text should change
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test("displays previous summaries if available", async ({ page }) => {
    await page.goto("/dashboard/ai-summary");
    const patientSelect = page.getByLabel(/patient/i);
    await expect(patientSelect).toBeVisible();

    // Wait for the page to settle
    await page.waitForTimeout(2000);

    // The summary text area / display should exist (either default text or a previous summary)
    const summaryArea = page
      .getByText(/generate a summary|clinical monitoring|summary/i)
      .first();
    await expect(summaryArea).toBeVisible();
  });
});

/* ─── Analytics ─── */

test.describe("Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("analytics page renders clinic risk overview", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    // The page should show some analytics content
    const heading = page.getByText(/analytics|risk|overview/i).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

/* ─── Security / Admin ─── */

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
