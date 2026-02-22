import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { buildPatientVitalsAnalytics, extractRiskFlags } from "./service";

export const analyticsRouter = Router();

const patientIdSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
});

analyticsRouter.get("/patient/:patientId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsed.error.flatten() });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: parsed.data.patientId, clinicId: req.clinicId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const [vitals, latestSummary] = await Promise.all([
    prisma.vitalRecord.findMany({
      where: { patientId: patient.id },
      orderBy: { recordedAt: "asc" },
      take: 200,
    }),
    prisma.aISummary.findFirst({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const analytics = buildPatientVitalsAnalytics(vitals);

  return res.status(200).json({
    patient,
    vitals: analytics,
    riskFlags: extractRiskFlags(latestSummary),
  });
});

analyticsRouter.get("/clinic-risk", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const summaries = await prisma.aISummary.findMany({
    where: {
      patient: {
        clinicId: req.clinicId,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 500,
  });

  const latestPerPatient = new Map<string, (typeof summaries)[number]>();
  for (const summary of summaries) {
    if (!latestPerPatient.has(summary.patientId)) {
      latestPerPatient.set(summary.patientId, summary);
    }
  }

  const latestSummaries = Array.from(latestPerPatient.values());

  const highRiskPatients = latestSummaries
    .filter((summary) => {
      const riskFlags = extractRiskFlags(summary);
      return (
        riskFlags.highBloodPressureTrend === true ||
        riskFlags.risingGlucoseTrend === true ||
        riskFlags.tachycardiaTrend === true
      );
    })
    .map((summary) => ({
      patientId: summary.patient.id,
      patientName: `${summary.patient.firstName} ${summary.patient.lastName}`,
      riskFlags: extractRiskFlags(summary),
      summaryCreatedAt: summary.createdAt,
    }));

  return res.status(200).json({
    totalPatientsWithSummary: latestSummaries.length,
    highRiskCount: highRiskPatients.length,
    highRiskPatients,
  });
});
