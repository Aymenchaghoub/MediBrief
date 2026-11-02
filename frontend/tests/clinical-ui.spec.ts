import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs/promises";

// Synthetic fixtures are confined to tests. Production screens never use them.
const patientId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const patients = [
  {
    id: patientId,
    firstName: "Alex",
    lastName: "Martin",
    dateOfBirth: "1990-01-15",
    gender: "OTHER",
    phone: null,
    createdAt: "2026-10-01T10:00:00Z",
  },
  {
    id: secondId,
    firstName: "Sam",
    lastName: "Bernard",
    dateOfBirth: "1985-06-20",
    gender: "OTHER",
    phone: null,
    createdAt: "2026-10-02T10:00:00Z",
  },
];
const summary = {
  id: "summary-demo",
  summaryText:
    "## Clinical monitoring\n\nDemonstration record for interface validation.\n\n### Recorded information\n\n- Vital signs and laboratory results are available in the patient record\n- Consultation notes are available for review\n\n### Follow-up\n\nReview the original record with the care team. This summary is monitoring support, not a diagnosis.",
  createdAt: "2026-10-20T09:00:00Z",
};
const appointment = {
  id: "appointment-demo",
  date: "2027-01-15T10:00:00Z",
  symptoms: "Scheduled follow-up · Demonstration record",
  notes: "Review recorded measurements",
  doctorName: "Robin Leclerc",
  createdAt: "2026-10-20T09:00:00Z",
};
const recordedVitals = [
  {
    id: "v1",
    type: "BP",
    value: "120/80",
    numericValue: 120,
    unit: "mmHg",
    recordedAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "v2",
    type: "BP",
    value: "132/84",
    numericValue: 132,
    unit: "mmHg",
    recordedAt: "2026-10-05T10:00:00Z",
  },
  {
    id: "v3",
    type: "GLUCOSE",
    value: "92",
    numericValue: 92,
    unit: "mg/dL",
    recordedAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "v4",
    type: "GLUCOSE",
    value: "98",
    numericValue: 98,
    unit: "mg/dL",
    recordedAt: "2026-10-05T10:00:00Z",
  },
];
const profile = {
  ...patients[0],
  email: "patient@example.test",
  clinic: { name: "Test clinic" },
};
const analytics = {
  patient: patients[0],
  vitals: {
    anomalyCount: 0,
    trends: ["BP", "GLUCOSE", "HEART_RATE", "WEIGHT"].map((metric) => ({
      metric,
      latest: null,
      points: 0,
      delta: 0,
      anomalies: [],
    })),
  },
  riskFlags: {},
  labFlags: [],
  riskScore: { score: 0, tier: "low", contributors: [] },
};
interface FixtureOptions {
  empty?: boolean;
  error?: string;
  role?: string;
  delay?: number;
  records?: unknown[];
  populated?: boolean;
}
async function mockApi(page: Page, options: FixtureOptions = {}) {
  await page.addInitScript(() => {
    localStorage.setItem("medibrief_token", "ui-test-session");
    localStorage.setItem("medibrief_patient_token", "ui-test-patient-session");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204 });
    if (options.delay && path !== "/users/me" && path !== "/portal/me")
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    if (options.error && path.includes(options.error))
      return route.fulfill({
        status: 503,
        json: { message: "Service temporarily unavailable" },
      });
    let data: unknown;
    if (path === "/users/me")
      data = { name: "Robin Leclerc", role: options.role ?? "DOCTOR" };
    else if (path === "/portal/me") data = profile;
    else if (path === "/patients")
      data = { data: options.empty ? [] : patients, nextCursor: null };
    else if (path === `/patients/${patientId}`) data = patients[0];
    else if (path === "/analytics/clinic-risk")
      data = { highRiskCount: 0, totalPatientsWithSummary: 1 };
    else if (path.startsWith("/analytics/patient/"))
      data = options.populated
        ? {
            ...analytics,
            vitals: {
              ...analytics.vitals,
              trends: analytics.vitals.trends.map((trend) => ({
                ...trend,
                latest:
                  trend.metric === "BP"
                    ? 132
                    : trend.metric === "GLUCOSE"
                      ? 98
                      : null,
                points: ["BP", "GLUCOSE"].includes(trend.metric) ? 2 : 0,
              })),
            },
          }
        : analytics;
    else if (path.startsWith("/vitals/"))
      data = options.records ?? (options.populated ? recordedVitals : []);
    else if (path === "/portal/vitals/analytics") data = analytics.vitals;
    else if (path === "/portal/vitals")
      data = options.populated ? recordedVitals : [];
    else if (path === "/portal/appointments")
      data = options.populated ? [appointment] : [];
    else if (path === "/portal/summaries")
      data = options.populated ? [summary] : [];
    else if (path.startsWith("/consultations/"))
      data = {
        data: options.populated
          ? [{ ...appointment, doctor: { name: appointment.doctorName } }]
          : [],
        nextCursor: null,
      };
    else if (path === "/audit")
      data = { records: [], total: 0, page: 1, limit: 20 };
    else if (path.startsWith("/ai/summaries/patient/"))
      data = options.populated ? [summary] : [];
    else if (path.startsWith("/ai/summaries/")) data = summary;
    else if (path.startsWith("/portal/")) data = [];
    else
      return route.fulfill({
        status: 404,
        json: { message: `Unmocked endpoint: ${path}` },
      });
    return route.fulfill({ status: 200, json: data });
  });
}
async function expectNoOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
}

for (const width of [390, 768, 1440]) {
  test(`authentication fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/auth",
      "/patient-auth",
      "/patient-auth?token=test-invite",
    ]) {
      await page.goto(path);
      await expect(page.locator(".auth-card")).toBeVisible();
      await expectNoOverflow(page);
      const bounds = await page.locator(".auth-card").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(16);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 16);
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    }
  });
}

test("analytics without measurements never renders fabricated curves", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/dashboard/analytics");
  await expect(
    page.getByText("No blood pressure measurements recorded"),
  ).toBeVisible();
  await expect(page.locator(".chart-line")).toHaveCount(0);
  await expect(
    page.getByText("No anomalies detected in the available measurements"),
  ).toBeVisible();
  await expect(page.getByText("System Healthy", { exact: true })).toHaveCount(
    0,
  );
});

test("charts use real dated measurements and expose original values", async ({
  page,
}) => {
  await mockApi(page, {
    records: [
      {
        id: "v1",
        type: "BP",
        value: "120/80",
        numericValue: 120,
        unit: "mmHg",
        recordedAt: "2026-10-01T10:00:00Z",
      },
      {
        id: "v2",
        type: "BP",
        value: "132/84",
        numericValue: 132,
        unit: "mmHg",
        recordedAt: "2026-10-05T10:00:00Z",
      },
    ],
  });
  await page.goto("/dashboard/analytics");
  await expect(
    page.getByRole("img", {
      name: /Blood pressure for Alex Martin: 2 measurements/,
    }),
  ).toBeVisible();
  await page.getByText("View 2 recorded measurements").click();
  await expect(
    page.getByRole("cell", { name: "120/80", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "132/84", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chart-line")).toHaveCount(1);
});

test("unavailable measurements are errors, never a reassuring empty result", async ({
  page,
}) => {
  await mockApi(page, { error: "/vitals/" });
  await page.goto("/dashboard/analytics");
  await expect(
    page.getByRole("alert").filter({ hasText: "Measurements unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".chart-line")).toHaveCount(0);
  await expect(
    page.getByText("No blood pressure measurements recorded"),
  ).toHaveCount(0);
});

test("new patient selection does not show the previous patient's measurements", async ({
  page,
}) => {
  await mockApi(page, { delay: 300 });
  await page.goto("/dashboard/analytics");
  await expect(
    page.getByText("No blood pressure measurements recorded"),
  ).toBeVisible();
  await page.getByLabel("Patient context").selectOption(secondId);
  await expect(page.getByText("Loading measurements…").first()).toBeVisible();
  await expect(
    page.getByText("No blood pressure measurements recorded"),
  ).toBeVisible();
});

const routes = [
  ["home", "/"],
  ["not-found", "/page-not-found"],
  ["clinic-auth", "/auth"],
  ["patient-auth", "/patient-auth"],
  ["dashboard", "/dashboard"],
  ["patients", "/dashboard/patients"],
  ["patient-record", `/dashboard/patients/${patientId}`],
  ["consultations", "/dashboard/consultations"],
  ["analytics", "/dashboard/analytics"],
  ["clinical-summary", "/dashboard/ai-summary"],
  ["audit", "/dashboard/security"],
  ["patient-overview", "/portal"],
  ["patient-records", "/portal/records"],
  ["patient-appointments", "/portal/appointments"],
  ["patient-summaries", "/portal/summaries"],
  ["patient-settings", "/portal/settings"],
];
for (const width of [390, 768, 1440]) {
  test(`all routes fit and render without runtime errors at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page, { populated: true, role: "ADMIN" });
    for (const [name, url] of routes) {
      await page.goto(url);
      await expect(page.locator("main, .auth-card").first()).toBeVisible();
      if (url.startsWith("/dashboard") || url.startsWith("/portal"))
        await expect(
          page.getByRole("button", { name: "Logout" }),
        ).toBeVisible();
      await expectNoOverflow(page);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(20, 20, 21)",
      );
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("body")).toHaveCSS(
        "font-family",
        /IBM Plex Sans/,
      );
      expect(errors, `Runtime errors on ${name}`).toEqual([]);
    }
  });
}

for (const context of ["clinic", "patient"]) {
  test(`${context} mobile navigation contains focus, closes with Escape and retains logout`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page);
    await page.goto(context === "clinic" ? "/dashboard" : "/portal");
    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    await toggle.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close navigation" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("link").last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close navigation" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(
      context === "clinic" ? /\/auth$/ : /\/patient-auth$/,
    );
  });
}

for (const role of ["DOCTOR", "ADMIN"]) {
  test(`navigation preserves the ${role} role`, async ({ page }) => {
    await mockApi(page, { role });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Robin Leclerc" }),
    ).toBeVisible();
    if (role === "ADMIN")
      await expect(
        page.getByRole("link", { name: "Security", exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("link", { name: "Security", exact: true }),
      ).toHaveCount(0);
  });
}

test("unauthenticated clinic and patient routes retain their redirects", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth$/);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/patient-auth$/);
});

for (const [url, error] of [
  ["/portal", "/portal/appointments"],
  ["/portal/records", "/portal/vitals"],
  ["/portal/appointments", "/portal/appointments"],
  ["/portal/summaries", "/portal/summaries"],
]) {
  test(`${url} distinguishes errors from empty records`, async ({ page }) => {
    await mockApi(page, { error });
    await page.goto(url);
    await expect(page.locator("main [role=alert]")).toContainText(
      "Service temporarily unavailable",
    );
    await expect(page.locator(".empty-state")).toHaveCount(0);
  });
}

test("portal loading state remains explicit", async ({ page }) => {
  await mockApi(page, { delay: 1000 });
  await page.goto("/portal/records");
  await expect(
    page.getByRole("status").filter({ hasText: "Loading records" }),
  ).toBeVisible();
  await expect(page.getByText("No vitals recorded")).toBeVisible();
});

test("record tabs work with arrow keys and retain password validation", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/portal/settings");
  await page.getByRole("tab", { name: "Personal Information" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Security", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Security", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByLabel("New Password", { exact: true })
    .fill("long-new-password");
  await page
    .getByLabel("Confirm New Password", { exact: true })
    .fill("different-password");
  await expect(
    page.getByRole("button", { name: "Update Password" }),
  ).toBeDisabled();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
});

test("patient summaries expand with native keyboard activation", async ({
  page,
}) => {
  await mockApi(page, { populated: true });
  await page.goto("/portal/summaries");
  const button = page.getByRole("button", { name: /Summary ·/ });
  await button.focus();
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("heading", { name: "Clinical monitoring", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("single readings and incompatible units do not invent a trend", async ({
  page,
}) => {
  await mockApi(page, {
    records: [
      recordedVitals[0],
      { ...recordedVitals[2], unit: "mmol/L" },
      recordedVitals[3],
    ],
  });
  await page.goto("/dashboard/analytics");
  await expect(
    page.getByText(
      "At least two numeric, dated measurements are needed to show a trend",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Measurements use different units. Review the original readings below",
    ),
  ).toBeVisible();
  await expect(page.locator(".chart-line")).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`WCAG A/AA checks on key screens at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page, { populated: true, role: "ADMIN" });
    for (const [, url] of routes) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      if (url.startsWith("/dashboard"))
        await expect(
          page.getByRole("heading", { name: "Robin Leclerc" }),
        ).toBeVisible();
      if (url.startsWith("/portal"))
        await expect(
          page.getByRole("button", { name: "Logout" }),
        ).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target),
        })),
        `Accessibility of ${url}`,
      ).toEqual([]);
    }
  });
}

test("capture all pages and business tabs", async ({ page }) => {
  test.skip(
    !process.env.CAPTURE_UI,
    "Run with CAPTURE_UI=1 to export the complete screenshot set",
  );
  test.setTimeout(180_000);
  await mockApi(page, { populated: true, role: "ADMIN" });
  const output =
    process.env.UI_CAPTURE_DIR ?? path.resolve("docs/ui/screenshots");
  await fs.mkdir(output, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await expectNoOverflow(page);
      await page.screenshot({
        path: path.join(output, `${name}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    };
    for (const [name, url] of routes) {
      await page.goto(url);
      if (url.startsWith("/dashboard"))
        await expect(
          page.getByRole("heading", { name: "Robin Leclerc" }),
        ).toBeVisible();
      if (url.startsWith("/portal"))
        await expect(
          page.getByRole("button", { name: "Logout" }),
        ).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await capture(name);
      if (name === "clinic-auth") {
        await page
          .getByRole("button", { name: "Register", exact: true })
          .click();
        await capture("clinic-register");
      }
      if (name === "patient-auth") {
        await page
          .getByRole("button", { name: "Activate", exact: true })
          .click();
        await capture("patient-activate");
      }
      if (name === "patient-record") {
        for (const tab of [
          "Vitals",
          "Labs",
          "Consultations",
          "AI Summary",
          "Chat",
        ]) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          await capture(
            `patient-record-${tab.toLowerCase().replaceAll(" ", "-")}`,
          );
        }
      }
      if (name === "patient-records") {
        await page.getByRole("tab", { name: /Lab Results/ }).click();
        await capture("patient-lab-results");
      }
      if (name === "patient-settings") {
        await page.getByRole("tab", { name: "Security", exact: true }).click();
        await capture("patient-security");
      }
      if (name === "patient-summaries") {
        await page.getByRole("button", { name: /Summary ·/ }).click();
        await capture("patient-summary-open");
      }
      if (name === "clinical-summary") {
        await page.locator(".ai-history-item").first().click();
        await capture("clinical-summary-document");
      }
    }
    await page.goto("/patient-auth?token=demonstration-invite");
    await expect(page.getByLabel("Invite Token")).toHaveValue(
      "demonstration-invite",
    );
    await capture("patient-invite");
  }
});

for (const patient of [false, true]) {
  test(`${patient ? "patient" : "clinic"} sign in preserves the request and stored session`, async ({
    page,
  }) => {
    await mockApi(page);
    let body: unknown;
    await page.route(
      patient ? "**/api/auth/patient-login" : "**/api/auth/login",
      async (route) => {
        body = route.request().postDataJSON();
        await route.fulfill({ json: { token: "signed-in-test-session" } });
      },
    );
    await page.goto(patient ? "/patient-auth" : "/auth");
    await page
      .getByLabel("Email", { exact: true })
      .fill("account@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-123");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(patient ? /\/portal$/ : /\/dashboard$/);
    expect(body).toEqual({
      email: "account@example.test",
      password: "test-password-123",
    });
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        patient ? "medibrief_patient_token" : "medibrief_token",
      ),
    ).toBe("signed-in-test-session");
  });
}

test("clinic registration retains every required field and the API contract", async ({
  page,
}) => {
  await mockApi(page);
  let body: unknown;
  await page.route("**/api/auth/register-clinic", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { token: "registered-test-session" } });
  });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Clinic name").fill("Test Clinic");
  await page.getByLabel("Clinic email").fill("clinic@example.test");
  await page.getByLabel("Admin name").fill("Robin Test");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("button", { name: "Create Clinic", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(body).toEqual({
    clinicName: "Test Clinic",
    clinicEmail: "clinic@example.test",
    subscriptionPlan: "portfolio",
    adminName: "Robin Test",
    adminEmail: "admin@example.test",
    password: "test-password-123",
  });
});

test("patient activation preserves the read-only invite and setup request", async ({
  page,
}) => {
  await mockApi(page);
  let body: unknown;
  await page.route("**/api/auth/patient-setup", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { token: "activated-test-session" } });
  });
  await page.goto("/patient-auth?token=invite-test-token");
  await expect(page.getByLabel("Invite Token")).toHaveValue(
    "invite-test-token",
  );
  await expect(page.getByLabel("Invite Token")).toHaveAttribute("readonly", "");
  await page.getByLabel("Email", { exact: true }).fill("patient@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Activate Account" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  expect(body).toEqual({
    inviteToken: "invite-test-token",
    email: "patient@example.test",
    password: "test-password-123",
  });
});

test("invalid credentials remain an error in the authentication form", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: { message: "Invalid credentials" } }),
  );
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("account@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.locator("form [role=alert]")).toContainText(
    "Invalid credentials",
  );
  await expect(page).toHaveURL(/\/auth$/);
});

test("patient creation keeps validation, submits the original fields and refreshes the registry", async ({
  page,
}) => {
  await mockApi(page);
  const created = {
    ...patients[0],
    id: "33333333-3333-4333-8333-333333333333",
    firstName: "Casey",
    lastName: "Test",
  };
  let body: unknown;
  await page.route(/\/api\/patients(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: created });
    }
    return route.fulfill({
      json: {
        data: body ? [...patients, created] : patients,
        nextCursor: null,
      },
    });
  });
  await page.goto("/dashboard/patients");
  await page
    .getByRole("button", { name: "Create Patient", exact: true })
    .click();
  expect(body).toBeUndefined();
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Test");
  await page.getByLabel("Date of birth").fill("1990-01-15");
  await page.getByLabel("Gender", { exact: true }).selectOption("OTHER");
  await page
    .getByRole("button", { name: "Create Patient", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Casey Test", exact: true }),
  ).toBeVisible();
  expect(body).toEqual({
    firstName: "Casey",
    lastName: "Test",
    dateOfBirth: "1990-01-15",
    gender: "OTHER",
  });
});

test("consultations retain their submitted patient, date, symptoms and notes", async ({
  page,
}) => {
  await mockApi(page);
  let body: unknown;
  await page.route("**/api/consultations", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: "new-consultation" } });
  });
  await page.goto("/dashboard/consultations");
  await expect(page.getByLabel("Patient", { exact: true })).toHaveValue(
    patientId,
  );
  await page.getByLabel("Consultation date").fill("2026-11-02T09:30");
  await page
    .getByLabel("Symptoms", { exact: true })
    .fill("Demonstration symptoms");
  await page.getByLabel("Clinical notes").fill("Demonstration notes");
  await page.getByRole("button", { name: "Add Consultation" }).click();
  await expect(page.locator(".toast-success")).toContainText(
    "Consultation created",
  );
  expect(body).toEqual({
    patientId,
    date: "2026-11-02T09:30",
    symptoms: "Demonstration symptoms",
    notes: "Demonstration notes",
  });
});

test("patient detail retains vital entry, lab entry and record chat", async ({
  page,
}) => {
  await mockApi(page);
  let vital: unknown;
  let lab: unknown;
  let chat: unknown;
  await page.route("**/api/vitals", async (route) => {
    vital = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: "new-vital" } });
  });
  await page.route("**/api/labs", async (route) => {
    lab = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: "new-lab" } });
  });
  await page.route("**/api/ai/chat/**", async (route) => {
    chat = route.request().postDataJSON();
    await route.fulfill({
      json: { answer: "Demonstration answer from the record" },
    });
  });
  await page.goto(`/dashboard/patients/${patientId}`);
  await page.getByRole("tab", { name: "Vitals", exact: true }).click();
  await page.getByRole("button", { name: /Record Vital/ }).click();
  await page.getByLabel(/Value/).fill("120/80");
  await page.getByRole("button", { name: /Save Vital/ }).click();
  await expect
    .poll(() => vital)
    .toMatchObject({ patientId, type: "BP", value: "120/80", unit: "mmHg" });
  await page.getByRole("tab", { name: "Labs", exact: true }).click();
  await page.getByRole("button", { name: /Add Lab Result/ }).click();
  await page.getByLabel(/Test Name/i).fill("Demonstration test");
  await page.getByLabel("Value", { exact: true }).fill("98");
  await page.getByRole("button", { name: /Save Lab/ }).click();
  await expect
    .poll(() => lab)
    .toMatchObject({ patientId, testName: "Demonstration test", value: "98" });
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Question about this patient’s record" })
    .fill("What is recorded?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Demonstration answer from the record"),
  ).toBeVisible();
  expect(chat).toEqual({ message: "What is recorded?" });
});

test("existing TXT and PDF summary exports still produce files", async ({
  page,
}) => {
  await mockApi(page, { populated: true });
  await page.goto("/dashboard/ai-summary");
  await page.locator(".ai-history-item").first().click();
  const textDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .txt", exact: true }).click();
  const text = await textDownload;
  expect(await fs.readFile((await text.path())!, "utf8")).toBe(
    summary.summaryText,
  );
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .pdf", exact: true }).click();
  const pdf = await pdfDownload;
  expect(
    (await fs.readFile((await pdf.path())!)).subarray(0, 5).toString(),
  ).toBe("%PDF-");
});

test("patient health report PDF export remains available", async ({ page }) => {
  await mockApi(page, { populated: true });
  await page.goto("/portal");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download health report" }).click();
  const pdf = await downloadEvent;
  expect(
    (await fs.readFile((await pdf.path())!)).subarray(0, 5).toString(),
  ).toBe("%PDF-");
});

test("summary generation retains queue, SSE completion and reduced-motion reading", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockApi(page);
  await page.route("**/api/ai/generate-summary/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 202,
      json: { jobId: "job-test", status: "queued", message: "Queued" },
    });
  });
  await page.route("**/api/ai/stream/**", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      headers: { "access-control-allow-origin": "*" },
      body: 'data: {"state":"completed","summaryId":"summary-demo","failedReason":null}\n\n',
    }),
  );
  await page.goto("/dashboard/ai-summary");
  await page
    .getByRole("button", { name: "Generate New Summary", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Generating summary" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Generating/ })).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Clinical monitoring", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export .pdf", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".streaming-cursor")).toHaveCount(0);
  await expect(page.locator(".toast-success")).toContainText(
    "Clinical summary generated",
  );
});

test("summary generation failure stays visible and cannot be exported as a result", async ({
  page,
}) => {
  await mockApi(page);
  await page.route("**/api/ai/generate-summary/**", (route) =>
    route.fulfill({ status: 503, json: { message: "Generation unavailable" } }),
  );
  await page.goto("/dashboard/ai-summary");
  await page
    .getByRole("button", { name: "Generate New Summary", exact: true })
    .click();
  await expect(page.locator(".ai-summary-output")).toContainText(
    "Generation unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Export .pdf", exact: true }),
  ).toBeDisabled();
});

test("dashboard does not report a partial patient list as full summary coverage", async ({
  page,
}) => {
  await mockApi(page);
  await page.route(/\/api\/patients(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { data: patients, nextCursor: "next-page" } }),
  );
  await page.goto("/dashboard");
  const cards = page.locator(".stat-card");
  await expect(
    cards
      .filter({ has: page.getByText("Patients", { exact: true }) })
      .locator(".metric-value"),
  ).toHaveText("2+");
  await expect(
    cards
      .filter({ has: page.getByText("Coverage", { exact: true }) })
      .locator(".metric-value"),
  ).toHaveText("—");
});

test("dashboard errors do not turn unavailable counts into zeros", async ({
  page,
}) => {
  await mockApi(page, { error: "/analytics/clinic-risk" });
  await page.goto("/dashboard");
  await expect(page.locator("main [role=alert]")).toContainText(
    "Service temporarily unavailable",
  );
  await expect(page.locator(".metric-value")).toHaveText(["—", "—", "—", "—"]);
});

test("KPI cards share an aligned row after global spacing changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockApi(page);
  await page.goto("/dashboard");
  await expect(page.locator(".metric-value").first()).toHaveText("2");
  const rectangles = await page.locator(".stat-card").evaluateAll((cards) =>
    cards.map((card) => ({
      y: card.getBoundingClientRect().y,
      height: card.getBoundingClientRect().height,
    })),
  );
  expect(new Set(rectangles.map((rect) => rect.y)).size).toBe(1);
  expect(new Set(rectangles.map((rect) => rect.height)).size).toBe(1);
});

test("settings load errors are explicit", async ({ page }) => {
  // The workspace profile request succeeds; the settings page's second request fails.
  await mockApi(page);
  let count = 0;
  await page.route("**/api/portal/me", (route) =>
    ++count === 1
      ? route.fulfill({ json: profile })
      : route.fulfill({
          status: 503,
          json: { message: "Profile unavailable" },
        }),
  );
  await page.goto("/portal/appointments");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "Profile unavailable",
  );
});

test("patient phone updates preserve their payload and success feedback", async ({
  page,
}) => {
  await mockApi(page);
  let body: unknown;
  await page.route("**/api/portal/me", async (route) => {
    if (route.request().method() === "PUT") {
      body = route.request().postDataJSON();
      return route.fulfill({ json: profile });
    }
    return route.fulfill({ json: profile });
  });
  await page.goto("/portal/settings");
  await page.getByLabel("Phone Number").fill("+33123456789");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.locator(".toast-success")).toContainText(
    "Phone number updated",
  );
  expect(body).toEqual({ phone: "+33123456789" });
});
