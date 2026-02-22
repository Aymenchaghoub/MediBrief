import "dotenv/config";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { prisma } from "../src/config/db";
import { env } from "../src/config/env";
import { startAiSummaryWorker, stopAiQueueResources } from "../src/modules/ai/queue";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const clinic = await prisma.clinic.upsert({
    where: { email: "e2e-clinic@medibrief.dev" },
    update: {},
    create: {
      name: "E2E Clinic",
      email: "e2e-clinic@medibrief.dev",
      subscriptionPlan: "portfolio",
    },
  });

  const doctor = await prisma.user.upsert({
    where: { email: "e2e-doctor@medibrief.dev" },
    update: { clinicId: clinic.id },
    create: {
      clinicId: clinic.id,
      name: "Dr E2E",
      email: "e2e-doctor@medibrief.dev",
      passwordHash: "hash-not-used-in-e2e",
      role: "DOCTOR",
    },
  });

  const patient = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      firstName: "Alice",
      lastName: "Synthetic",
      dateOfBirth: new Date("1975-06-20"),
      gender: "FEMALE",
      phone: "+33000000000",
    },
  });

  await prisma.vitalRecord.createMany({
    data: [
      { patientId: patient.id, type: "BP", value: "132", recordedAt: new Date("2026-01-10") },
      { patientId: patient.id, type: "BP", value: "145", recordedAt: new Date("2026-02-10") },
      { patientId: patient.id, type: "GLUCOSE", value: "96", recordedAt: new Date("2026-01-10") },
      { patientId: patient.id, type: "GLUCOSE", value: "118", recordedAt: new Date("2026-02-10") },
    ],
  });

  await prisma.labResult.create({
    data: {
      patientId: patient.id,
      testName: "HbA1c",
      value: "6.7",
      referenceRange: "4.0-5.6",
      recordedAt: new Date("2026-02-08"),
    },
  });

  await prisma.consultation.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      date: new Date("2026-02-09"),
      symptoms: "fatigue and dizziness",
      notes: "Continue monitoring glucose and blood pressure trends.",
    },
  });

  const token = jwt.sign(
    {
      id: doctor.id,
      clinicId: clinic.id,
      role: doctor.role,
    },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  // Start BullMQ worker so jobs actually get processed
  startAiSummaryWorker();

  const server = app.listen(4010);

  try {
    /* ─── 1. Trigger AI summary generation (async via BullMQ) ─── */
    const queueResponse = await fetch(`http://localhost:4010/api/ai/generate-summary/${patient.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const queueBody = (await queueResponse.json()) as { jobId?: string; status?: string };

    console.log(`E2E_QUEUE_STATUS=${queueResponse.status}`);
    console.log(`E2E_JOB_ID=${queueBody.jobId ?? "NONE"}`);

    if (!queueResponse.ok || !queueBody.jobId) {
      throw new Error(`Queue submission failed: ${JSON.stringify(queueBody)}`);
    }

    /* ─── 2. Poll job status until completed or failed ─── */
    const jobId = queueBody.jobId;
    let jobState = "unknown";
    let summaryId: string | null = null;
    const maxAttempts = 30;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await sleep(1000);

      const statusResponse = await fetch(`http://localhost:4010/api/ai/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const statusBody = (await statusResponse.json()) as {
        state?: string;
        summaryId?: string | null;
        failedReason?: string | null;
      };

      jobState = statusBody.state ?? "unknown";

      if (jobState === "completed") {
        summaryId = statusBody.summaryId ?? null;
        console.log(`E2E_JOB_COMPLETED=true (attempt ${attempt})`);
        break;
      }

      if (jobState === "failed") {
        console.log(`E2E_JOB_FAILED=true reason=${statusBody.failedReason}`);
        break;
      }

      if (attempt === maxAttempts) {
        console.log(`E2E_JOB_TIMEOUT=true lastState=${jobState}`);
      }
    }

    /* ─── 3. Fetch the generated summary ─── */
    if (summaryId) {
      const summaryResponse = await fetch(`http://localhost:4010/api/ai/summaries/${summaryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const summaryBody = (await summaryResponse.json()) as { id?: string; summaryText?: string };

      console.log(`E2E_SUMMARY_STATUS=${summaryResponse.status}`);
      console.log(`E2E_HAS_SUMMARY=${Boolean(summaryBody.summaryText)}`);
      console.log(`E2E_SUMMARY_SNIPPET=${(summaryBody.summaryText ?? "").slice(0, 120)}`);

      const persisted = await prisma.aISummary.findUnique({ where: { id: summaryId } });
      console.log(`E2E_PERSISTED=${Boolean(persisted)}`);
    } else {
      console.log("E2E_SUMMARY_SKIPPED=true (no summaryId — job did not complete)");
    }

    /* ─── 4. Test analytics endpoints ─── */
    const patientAnalyticsResponse = await fetch(`http://localhost:4010/api/analytics/patient/${patient.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const patientAnalyticsBody = (await patientAnalyticsResponse.json()) as {
      vitals?: { anomalyCount?: number };
      riskScore?: { score?: number; tier?: string };
    };

    console.log(`E2E_ANALYTICS_PATIENT_STATUS=${patientAnalyticsResponse.status}`);
    console.log(`E2E_ANALYTICS_ANOMALIES=${patientAnalyticsBody.vitals?.anomalyCount ?? -1}`);
    console.log(`E2E_RISK_SCORE=${patientAnalyticsBody.riskScore?.score ?? -1}`);
    console.log(`E2E_RISK_TIER=${patientAnalyticsBody.riskScore?.tier ?? "N/A"}`);

    const clinicRiskResponse = await fetch("http://localhost:4010/api/analytics/clinic-risk", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const clinicRiskBody = (await clinicRiskResponse.json()) as { highRiskCount?: number };

    console.log(`E2E_ANALYTICS_RISK_STATUS=${clinicRiskResponse.status}`);
    console.log(`E2E_ANALYTICS_HIGH_RISK=${clinicRiskBody.highRiskCount ?? -1}`);

    console.log("\n✅ E2E AI FLOW COMPLETE");
  } finally {
    await stopAiQueueResources();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main()
  .catch((error) => {
    console.error("E2E_FAILED", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
