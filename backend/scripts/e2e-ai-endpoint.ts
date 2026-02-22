import "dotenv/config";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { prisma } from "../src/config/db";
import { env } from "../src/config/env";

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

  const server = app.listen(4010);

  try {
    const response = await fetch(`http://localhost:4010/api/ai/generate-summary/${patient.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json()) as { id?: string; summaryText?: string };

    console.log(`E2E_STATUS=${response.status}`);
    console.log(`E2E_HAS_SUMMARY=${Boolean(body.summaryText)}`);

    if (!response.ok || !body.id) {
      throw new Error("E2E endpoint call failed");
    }

    const persisted = await prisma.aISummary.findUnique({ where: { id: body.id } });

    console.log(`E2E_PERSISTED=${Boolean(persisted)}`);
    console.log(`E2E_SUMMARY_SNIPPET=${(persisted?.summaryText ?? "").slice(0, 120)}`);

    const patientAnalyticsResponse = await fetch(`http://localhost:4010/api/analytics/patient/${patient.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const patientAnalyticsBody = (await patientAnalyticsResponse.json()) as {
      vitals?: { anomalyCount?: number };
    };

    console.log(`E2E_ANALYTICS_PATIENT_STATUS=${patientAnalyticsResponse.status}`);
    console.log(`E2E_ANALYTICS_ANOMALIES=${patientAnalyticsBody.vitals?.anomalyCount ?? -1}`);

    const clinicRiskResponse = await fetch("http://localhost:4010/api/analytics/clinic-risk", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const clinicRiskBody = (await clinicRiskResponse.json()) as {
      highRiskCount?: number;
    };

    console.log(`E2E_ANALYTICS_RISK_STATUS=${clinicRiskResponse.status}`);
    console.log(`E2E_ANALYTICS_HIGH_RISK=${clinicRiskBody.highRiskCount ?? -1}`);
  } finally {
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
