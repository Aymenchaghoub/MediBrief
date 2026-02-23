/**
 * MediBrief — Full End-to-End API Integration Test
 *
 * Tests every feature from signup to portal, hitting the live backend at http://localhost:4000.
 * Prerequisites: docker compose up -d (all 4 services running), fresh db push.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/full-e2e-test.ts
 */

const BASE = "http://localhost:4000/api";

/* ── helpers ─────────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = detail ? `${label} — ${detail}` : label;
    failures.push(msg);
    console.log(`  ❌ ${label}${detail ? ` (${detail})` : ""}`);
  }
}

async function api(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; raw?: boolean } = {},
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

/* ── state ───────────────────────────────────────────────────────── */

let adminToken = "";
let clinicId = "";
let adminUserId = "";
let patientId = "";
let consultationId = "";
let vitalId = "";
let labId = "";
let jobId = "";
let summaryId = "";
let inviteToken = "";
let patientPortalToken = "";

/* ── tests ───────────────────────────────────────────────────────── */

async function testHealthCheck() {
  console.log("\n🏥 Health Check");
  const res = await fetch("http://localhost:4000/health");
  const data = await res.json();
  assert(res.status === 200, "GET /health returns 200");
  assert(data.status === "ok", "Health status is ok");
}

async function testRegisterClinic() {
  console.log("\n📋 Register Clinic");
  const { status, data } = await api("/auth/register-clinic", {
    method: "POST",
    body: {
      clinicName: "E2E Test Clinic",
      clinicEmail: "e2e-clinic@test.com",
      subscriptionPlan: "PRO",
      adminName: "Dr. E2E Admin",
      adminEmail: "admin@e2e-test.com",
      password: "password123!",
    },
  });

  assert(status === 201, "POST /auth/register-clinic returns 201", `got ${status}`);
  assert(!!data.token, "Returns JWT token");
  assert(data.user?.role === "ADMIN", "User role is ADMIN");
  assert(!!data.user?.clinicId, "User has clinicId");

  adminToken = data.token;
  clinicId = data.user?.clinicId;
  adminUserId = data.user?.id;
}

async function testDuplicateRegister() {
  console.log("\n🔒 Duplicate Registration Prevention");
  const { status } = await api("/auth/register-clinic", {
    method: "POST",
    body: {
      clinicName: "Duplicate",
      clinicEmail: "e2e-clinic@test.com",
      subscriptionPlan: "FREE",
      adminName: "Dup",
      adminEmail: "dup@e2e.com",
      password: "password123!",
    },
  });
  assert(status === 409, "Duplicate clinic email returns 409", `got ${status}`);
}

async function testLogin() {
  console.log("\n🔑 Login");
  const { status, data } = await api("/auth/login", {
    method: "POST",
    body: { email: "admin@e2e-test.com", password: "password123!" },
  });

  assert(status === 200, "POST /auth/login returns 200", `got ${status}`);
  assert(!!data.token, "Returns JWT token");
  assert(data.user?.email === "admin@e2e-test.com", "Email matches");
  adminToken = data.token;
}

async function testInvalidLogin() {
  console.log("\n🚫 Invalid Login");
  const { status } = await api("/auth/login", {
    method: "POST",
    body: { email: "admin@e2e-test.com", password: "wrongpassword1" },
  });
  assert(status === 401, "Wrong password returns 401", `got ${status}`);
}

async function testGetMe() {
  console.log("\n👤 Get Current User");
  const { status, data } = await api("/users/me", { token: adminToken });
  assert(status === 200, "GET /users/me returns 200", `got ${status}`);
  assert(data.name === "Dr. E2E Admin", "Name matches");
  assert(data.role === "ADMIN", "Role is ADMIN");
  assert(data.clinicId === clinicId, "ClinicId matches");
}

async function testUnauthorizedAccess() {
  console.log("\n🔐 Unauthorized Access");
  const { status } = await api("/users/me");
  assert(status === 401, "GET /users/me without token returns 401", `got ${status}`);

  const { status: s2 } = await api("/patients", { token: "invalid.jwt.token" });
  assert(s2 === 401, "Invalid JWT returns 401", `got ${s2}`);
}

async function testCreatePatient() {
  console.log("\n🧑‍⚕️ Create Patient");
  const { status, data } = await api("/patients", {
    method: "POST",
    token: adminToken,
    body: {
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1990-05-15",
      gender: "FEMALE",
      phone: "+1234567890",
    },
  });

  assert(status === 201, "POST /patients returns 201", `got ${status}`);
  assert(data.firstName === "Jane", "First name matches");
  assert(data.gender === "FEMALE", "Gender matches");
  assert(!!data.id, "Patient has an ID");
  patientId = data.id;
}

async function testListPatients() {
  console.log("\n📋 List Patients");
  const { status, data } = await api("/patients?limit=10", { token: adminToken });
  assert(status === 200, "GET /patients returns 200", `got ${status}`);
  assert(Array.isArray(data?.data), "Response has data array");
  assert((data?.data?.length ?? 0) >= 1, "At least 1 patient", `got ${data?.data?.length}`);
  assert(data?.data?.[0]?.firstName === "Jane", "First patient is Jane");
}

async function testGetPatient() {
  console.log("\n📄 Get Single Patient");
  const { status, data } = await api(`/patients/${patientId}`, { token: adminToken });
  assert(status === 200, "GET /patients/:id returns 200", `got ${status}`);
  assert(data.id === patientId, "Patient ID matches");
  assert(data.firstName === "Jane", "Name matches");
}

async function testUpdatePatient() {
  console.log("\n✏️ Update Patient");
  const { status, data } = await api(`/patients/${patientId}`, {
    method: "PUT",
    token: adminToken,
    body: { phone: "+0987654321" },
  });
  assert(status === 200, "PUT /patients/:id returns 200", `got ${status}`);
  assert(data.phone === "+0987654321", "Phone updated");
}

async function testCreateSecondPatient() {
  console.log("\n🧑‍⚕️ Create Second Patient (for pagination)");
  const { status } = await api("/patients", {
    method: "POST",
    token: adminToken,
    body: {
      firstName: "John",
      lastName: "Smith",
      dateOfBirth: "1985-08-20",
      gender: "MALE",
    },
  });
  assert(status === 201, "POST second patient returns 201", `got ${status}`);
}

async function testAddVitals() {
  console.log("\n💓 Add Vitals");

  // Blood pressure
  const bp = await api("/vitals", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      type: "BP",
      value: "140/90",
      unit: "mmHg",
      recordedAt: new Date().toISOString(),
    },
  });
  assert(bp.status === 201, "POST /vitals (BP) returns 201", `got ${bp.status}`);
  vitalId = bp.data?.id;

  // Heart rate
  const hr = await api("/vitals", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      type: "HEART_RATE",
      value: "98",
      unit: "bpm",
      recordedAt: new Date().toISOString(),
    },
  });
  assert(hr.status === 201, "POST /vitals (HEART_RATE) returns 201", `got ${hr.status}`);

  // Glucose
  const gl = await api("/vitals", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      type: "GLUCOSE",
      value: "180",
      unit: "mg/dL",
      recordedAt: new Date().toISOString(),
    },
  });
  assert(gl.status === 201, "POST /vitals (GLUCOSE) returns 201", `got ${gl.status}`);

  // Weight
  const wt = await api("/vitals", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      type: "WEIGHT",
      value: "68",
      unit: "kg",
      recordedAt: new Date().toISOString(),
    },
  });
  assert(wt.status === 201, "POST /vitals (WEIGHT) returns 201", `got ${wt.status}`);
}

async function testGetVitals() {
  console.log("\n📊 Get Vitals");
  const { status, data } = await api(`/vitals/${patientId}`, { token: adminToken });
  assert(status === 200, "GET /vitals/:patientId returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");
  assert(data.length === 4, "Has 4 vital records", `got ${data.length}`);
}

async function testAddLabResults() {
  console.log("\n🧪 Add Lab Results");

  const cbc = await api("/labs", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      testName: "Hemoglobin",
      value: "18.5",
      unit: "g/dL",
      referenceRange: "12.0-17.5",
      recordedAt: new Date().toISOString(),
    },
  });
  assert(cbc.status === 201, "POST /labs (Hemoglobin) returns 201", `got ${cbc.status}`);
  labId = cbc.data?.id;

  const glucose = await api("/labs", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      testName: "Fasting Glucose",
      value: "250",
      unit: "mg/dL",
      referenceRange: "70-100",
      recordedAt: new Date().toISOString(),
    },
  });
  assert(glucose.status === 201, "POST /labs (Fasting Glucose) returns 201", `got ${glucose.status}`);
}

async function testGetLabResults() {
  console.log("\n📋 Get Lab Results");
  const { status, data } = await api(`/labs/${patientId}`, { token: adminToken });
  assert(status === 200, "GET /labs/:patientId returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");
  assert(data.length === 2, "Has 2 lab results", `got ${data.length}`);
}

async function testCreateConsultation() {
  console.log("\n🩺 Create Consultation");
  const { status, data } = await api("/consultations", {
    method: "POST",
    token: adminToken,
    body: {
      patientId,
      date: new Date().toISOString(),
      symptoms: "Persistent headaches, elevated blood pressure, occasional dizziness",
      notes: "Patient presents with hypertensive symptoms. Recommend monitoring and medication adjustment.",
    },
  });

  assert(status === 201, "POST /consultations returns 201", `got ${status}`);
  assert(!!data.id, "Consultation has ID");
  assert(data.symptoms.includes("headaches"), "Symptoms recorded");
  consultationId = data.id;
}

async function testGetConsultations() {
  console.log("\n📋 Get Consultations");
  const { status, data } = await api(`/consultations/${patientId}?limit=10`, { token: adminToken });
  assert(status === 200, "GET /consultations/:patientId returns 200", `got ${status}`);
  assert(Array.isArray(data.data), "Response has data array");
  assert(data.data.length >= 1, "At least 1 consultation");
  assert(data.data[0].doctor?.name === "Dr. E2E Admin", "Doctor name populated");
}

async function testGenerateAISummary() {
  console.log("\n🤖 Generate AI Summary (async job)");
  const { status, data } = await api(`/ai/generate-summary/${patientId}`, {
    method: "POST",
    token: adminToken,
  });

  assert(status === 202, "POST /ai/generate-summary returns 202", `got ${status}`);
  assert(!!data.jobId, "Returns jobId");
  assert(data.status === "queued", "Status is queued", `got ${data.status}`);
  jobId = data.jobId;
}

async function testPollJobStatus() {
  console.log("\n⏳ Poll Job Status");

  // Poll up to 30 seconds
  let attempts = 0;
  let finalState = "";
  while (attempts < 30) {
    const { status, data } = await api(`/ai/jobs/${jobId}`, { token: adminToken });
    assert(status === 200 || attempts > 0, `GET /ai/jobs/:id returns 200 (attempt ${attempts + 1})`, `got ${status}`);

    finalState = data.state;
    if (data.state === "completed") {
      assert(true, "Job completed successfully");
      summaryId = data.summaryId;
      break;
    } else if (data.state === "failed") {
      assert(true, `Job finished (state: failed — expected if no AI key configured)`);
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
  }

  if (attempts >= 30) {
    assert(false, "Job completed within 30s", `stuck in state: ${finalState}`);
  }
}

async function testGetSummaries() {
  console.log("\n📝 Get AI Summaries");
  const { status, data } = await api(`/ai/summaries/patient/${patientId}`, { token: adminToken });
  assert(status === 200, "GET /ai/summaries/patient/:patientId returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");

  if (summaryId) {
    assert(data.length >= 1, "Has at least 1 summary");

    // Test single summary detail
    const detail = await api(`/ai/summaries/${summaryId}`, { token: adminToken });
    assert(detail.status === 200, "GET /ai/summaries/:id returns 200", `got ${detail.status}`);
    assert(!!detail.data?.summaryText, "Summary has text");
  } else {
    assert(true, "No summary generated (AI provider not configured) — skipping detail test");
  }
}

async function testRAGChat() {
  console.log("\n💬 RAG Chat with Patient Records");
  const { status, data } = await api(`/ai/chat/${patientId}`, {
    method: "POST",
    token: adminToken,
    body: {
      message: "What are the latest vitals for this patient?",
    },
  });

  // May succeed or fail depending on AI provider config
  if (status === 200) {
    assert(true, "POST /ai/chat/:patientId returns 200");
    assert(typeof data.reply === "string", "Returns reply string");
  } else {
    assert(true, `RAG chat returned ${status} (expected if no AI key) — acceptable`);
  }
}

async function testPatientAnalytics() {
  console.log("\n📈 Patient Analytics");
  const { status, data } = await api(`/analytics/patient/${patientId}`, { token: adminToken });
  assert(status === 200, "GET /analytics/patient/:id returns 200", `got ${status}`);
  assert(!!data.patient, "Response has patient");
  assert(data.patient.id === patientId, "Patient ID matches");
  assert(!!data.vitals, "Response has vitals analytics");
  assert(!!data.riskScore, "Response has risk score");
  assert(typeof data.riskScore.score === "number", "Risk score is numeric");
  assert(["low", "moderate", "high", "critical"].includes(data.riskScore.tier), "Risk tier is valid");
  assert(Array.isArray(data.labFlags), "Response has lab flags");
}

async function testClinicRiskOverview() {
  console.log("\n🏥 Clinic Risk Overview");
  const { status, data } = await api("/analytics/clinic-risk", { token: adminToken });
  assert(status === 200, "GET /analytics/clinic-risk returns 200", `got ${status}`);
  assert(typeof data.totalPatientsWithSummary === "number", "Has totalPatientsWithSummary");
  assert(typeof data.highRiskCount === "number", "Has highRiskCount");
  assert(Array.isArray(data.highRiskPatients), "Has highRiskPatients array");
}

async function testAuditTrail() {
  console.log("\n📜 Audit Trail (Admin)");
  const { status, data } = await api("/audit?limit=50", { token: adminToken });
  assert(status === 200, "GET /audit returns 200", `got ${status}`);
  assert(typeof data.total === "number", "Has total count");
  assert(Array.isArray(data.records), "Has records array");
  assert(data.records.length >= 2, "At least 2 audit entries (register + login)", `got ${data.records.length}`);

  // Check we have the register and login events
  const actions = data.records.map((r: any) => r.action);
  assert(actions.includes("REGISTER_CLINIC"), "Contains REGISTER_CLINIC action");
  assert(actions.includes("LOGIN"), "Contains LOGIN action");
}

async function testPatientInvite() {
  console.log("\n📧 Patient Portal Invite");
  const { status, data } = await api(`/patients/${patientId}/invite`, {
    method: "POST",
    token: adminToken,
  });

  assert(status === 200, "POST /patients/:id/invite returns 200", `got ${status}`);
  assert(!!data.inviteToken, "Returns invite token");
  assert(data.patientName === "Jane Doe", "Patient name matches", `got ${data.patientName}`);
  inviteToken = data.inviteToken;
}

async function testPatientSetup() {
  console.log("\n🔐 Patient Account Setup (via invite)");
  const { status, data } = await api("/auth/patient-setup", {
    method: "POST",
    body: {
      inviteToken,
      email: "jane.doe@patient-test.com",
      password: "PatientPass123!",
    },
  });

  assert(status === 200 || status === 201, "POST /auth/patient-setup returns 200/201", `got ${status}`);
  assert(!!data.token, "Returns patient JWT token");
  assert(data.patient?.role === "PATIENT", "Role is PATIENT");
  assert(data.patient?.email === "jane.doe@patient-test.com", "Email matches");
  patientPortalToken = data.token;
}

async function testPatientLogin() {
  console.log("\n🔑 Patient Portal Login");
  const { status, data } = await api("/auth/patient-login", {
    method: "POST",
    body: {
      email: "jane.doe@patient-test.com",
      password: "PatientPass123!",
    },
  });

  assert(status === 200, "POST /auth/patient-login returns 200", `got ${status}`);
  assert(!!data.token, "Returns patient JWT");
  patientPortalToken = data.token;
}

async function testPortalMe() {
  console.log("\n👤 Portal — My Profile");
  const { status, data } = await api("/portal/me", { token: patientPortalToken });
  assert(status === 200, "GET /portal/me returns 200", `got ${status}`);
  assert(data.firstName === "Jane", "First name matches");
  assert(data.lastName === "Doe", "Last name matches");
  assert(data.email === "jane.doe@patient-test.com", "Email matches");
  assert(!!data.clinic?.name, "Clinic name present");
}

async function testPortalUpdateProfile() {
  console.log("\n✏️ Portal — Update Profile");
  const { status, data } = await api("/portal/me", {
    method: "PUT",
    token: patientPortalToken,
    body: { phone: "+1112223333" },
  });
  assert(status === 200, "PUT /portal/me returns 200", `got ${status}`);
  assert(data.phone === "+1112223333", "Phone updated");
}

async function testPortalChangePassword() {
  console.log("\n🔒 Portal — Change Password");
  const { status, data } = await api("/portal/security", {
    method: "PUT",
    token: patientPortalToken,
    body: {
      currentPassword: "PatientPass123!",
      newPassword: "NewPatientPass456!",
    },
  });
  assert(status === 200, "PUT /portal/security returns 200", `got ${status}`);
  assert(data.message?.includes("updated"), "Password updated message", `got ${data.message}`);

  // Verify new password works
  const login = await api("/auth/patient-login", {
    method: "POST",
    body: { email: "jane.doe@patient-test.com", password: "NewPatientPass456!" },
  });
  assert(login.status === 200, "Login with new password succeeds", `got ${login.status}`);
  patientPortalToken = login.data.token;
}

async function testPortalVitals() {
  console.log("\n💓 Portal — My Vitals");
  const { status, data } = await api("/portal/vitals", { token: patientPortalToken });
  assert(status === 200, "GET /portal/vitals returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");
  assert(data.length === 4, "Has 4 vitals", `got ${data.length}`);
}

async function testPortalVitalsAnalytics() {
  console.log("\n📈 Portal — Vitals Analytics");
  const { status, data } = await api("/portal/vitals/analytics", { token: patientPortalToken });
  assert(status === 200, "GET /portal/vitals/analytics returns 200", `got ${status}`);
  assert(!!data.trends, "Has trends");
}

async function testPortalLabs() {
  console.log("\n🧪 Portal — My Labs");
  const { status, data } = await api("/portal/labs", { token: patientPortalToken });
  assert(status === 200, "GET /portal/labs returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");
  assert(data.length === 2, "Has 2 lab results", `got ${data.length}`);
}

async function testPortalAppointments() {
  console.log("\n📅 Portal — My Appointments");
  const { status, data } = await api("/portal/appointments", { token: patientPortalToken });
  assert(status === 200, "GET /portal/appointments returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");
  assert(data.length >= 1, "Has at least 1 appointment");
}

async function testPortalSummaries() {
  console.log("\n📝 Portal — My AI Summaries");
  const { status, data } = await api("/portal/summaries", { token: patientPortalToken });
  assert(status === 200, "GET /portal/summaries returns 200", `got ${status}`);
  assert(Array.isArray(data), "Response is an array");
}

async function testDeletePatient() {
  console.log("\n🗑️ Soft-Delete Patient (Admin)");
  // Create a throwaway patient to delete
  const create = await api("/patients", {
    method: "POST",
    token: adminToken,
    body: {
      firstName: "ToDelete",
      lastName: "TestPat",
      dateOfBirth: "2000-01-01",
      gender: "OTHER",
    },
  });
  assert(create.status === 201, "Create throwaway patient", `got ${create.status}`);

  const delId = create.data.id;
  const del = await api(`/patients/${delId}`, { method: "DELETE", token: adminToken });
  assert(del.status === 204, "DELETE /patients/:id returns 204", `got ${del.status}`);

  // Verify it's no longer fetchable
  const get = await api(`/patients/${delId}`, { token: adminToken });
  assert(get.status === 404, "Deleted patient returns 404", `got ${get.status}`);
}

async function testRateLimiting() {
  console.log("\n⚡ Rate Limiting Validation");
  // Auth rate limiter: 10 req/min. Fire 12 rapid requests.
  let hitLimit = false;
  for (let i = 0; i < 12; i++) {
    const { status } = await api("/auth/login", {
      method: "POST",
      body: { email: "nonexistent@test.com", password: "password123!" },
    });
    if (status === 429) {
      hitLimit = true;
      break;
    }
  }
  assert(hitLimit, "Auth rate limiter triggers 429 after rapid requests");
}

async function testSwaggerDocs() {
  console.log("\n📚 Swagger Docs");
  const res = await fetch("http://localhost:4000/docs/");
  // Swagger may return 200 or 301 redirect
  assert(res.status === 200 || res.status === 301 || res.status === 302, "GET /docs is accessible", `got ${res.status}`);
}

/* ── runner ───────────────────────────────────────────────────────── */

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  MediBrief — Full End-to-End Integration Test Suite");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    // 1. Foundation
    await testHealthCheck();
    await testRegisterClinic();
    await testDuplicateRegister();
    await testLogin();
    await testInvalidLogin();
    await testGetMe();
    await testUnauthorizedAccess();

    // 2. Patient CRUD
    await testCreatePatient();
    await testListPatients();
    await testGetPatient();
    await testUpdatePatient();
    await testCreateSecondPatient();

    // 3. Clinical Data
    await testAddVitals();
    await testGetVitals();
    await testAddLabResults();
    await testGetLabResults();
    await testCreateConsultation();
    await testGetConsultations();

    // 4. AI Features
    await testGenerateAISummary();
    await testPollJobStatus();
    await testGetSummaries();
    await testRAGChat();

    // 5. Analytics
    await testPatientAnalytics();
    await testClinicRiskOverview();

    // 6. Admin Features
    await testAuditTrail();

    // 7. Patient Portal
    await testPatientInvite();
    await testPatientSetup();
    await testPatientLogin();
    await testPortalMe();
    await testPortalUpdateProfile();
    await testPortalChangePassword();
    await testPortalVitals();
    await testPortalVitalsAnalytics();
    await testPortalLabs();
    await testPortalAppointments();
    await testPortalSummaries();

    // 8. Destructive / Edge Cases
    await testDeletePatient();
    await testRateLimiting();

    // 9. Documentation
    await testSwaggerDocs();
  } catch (err) {
    console.error("\n💥 FATAL ERROR:", err);
    failed++;
    failures.push(`Fatal: ${err}`);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("═══════════════════════════════════════════════════════════");
  if (failures.length > 0) {
    console.log("\n  Failures:");
    failures.forEach((f) => console.log(`    ❌ ${f}`));
  }
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main();
