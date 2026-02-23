import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { writeAuditLog } from "../../utils/audit-log";
import { invalidateAiStructuredInputCache } from "../ai/queue";

export const labsRouter = Router();

const patientIdParamsSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
});

const createLabSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
  testName: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
  unit: z.string().max(20).optional(),
  referenceRange: z.string().max(120).optional(),
  recordedAt: z.coerce.date(),
});

async function ensurePatientInTenant(patientId: string, clinicId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, clinicId, isArchived: false },
    select: { id: true },
  });
}

labsRouter.post("/", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = createLabSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const patient = await ensurePatientInTenant(parsed.data.patientId, req.clinicId);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  try {
    const numericValue = Number.parseFloat(parsed.data.value);
    const lab = await prisma.labResult.create({
      data: {
        patientId: parsed.data.patientId,
        testName: parsed.data.testName,
        value: parsed.data.value,
        numericValue: Number.isFinite(numericValue) ? numericValue : null,
        unit: parsed.data.unit || "",
        referenceRange: parsed.data.referenceRange,
        recordedAt: parsed.data.recordedAt,
      },
    });

    await writeAuditLog(prisma, {
      userId: req.user.id,
      action: "LAB_CREATE",
      entityType: "LAB_RESULT",
      entityId: lab.id,
    });

    await invalidateAiStructuredInputCache(parsed.data.patientId);

    return res.status(201).json(lab);
  } catch {
    return res.status(500).json({ message: "Unable to create lab result" });
  }
});

labsRouter.get("/:patientId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const patient = await ensurePatientInTenant(parsedParams.data.patientId, req.clinicId);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const records = await prisma.labResult.findMany({
    where: { patientId: parsedParams.data.patientId, deletedAt: null },
    orderBy: { recordedAt: "desc" },
  });

  return res.status(200).json(records);
});
