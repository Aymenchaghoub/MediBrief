import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { writeAuditLog } from "../../utils/audit-log";
import { buildStructuredInput, generateClinicalSummary } from "./service";

export const aiRouter = Router();

const patientIdParamsSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
});

aiRouter.post("/generate-summary/:patientId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const patientId = parsedParams.data.patientId;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: req.clinicId },
  });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const [vitals, labs, consultations] = await Promise.all([
    prisma.vitalRecord.findMany({ where: { patientId }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.labResult.findMany({ where: { patientId }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.consultation.findMany({ where: { patientId }, orderBy: { date: "desc" }, take: 10 }),
  ]);

  try {
    const structuredInput = buildStructuredInput(patient, vitals, labs, consultations);
    const generated = await generateClinicalSummary(structuredInput);

    const aiSummary = await prisma.aISummary.create({
      data: {
        patientId,
        summaryText: generated.summaryText,
        riskFlags: generated.riskFlags,
      },
    });

    await writeAuditLog(prisma, {
      userId: req.user.id,
      action: "AI_SUMMARY_GENERATE",
      entityType: "AI_SUMMARY",
      entityId: aiSummary.id,
    });

    return res.status(201).json(aiSummary);
  } catch {
    return res.status(500).json({ message: "Unable to generate AI summary" });
  }
});
