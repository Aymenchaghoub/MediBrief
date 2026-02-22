import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { writeAuditLog } from "../../utils/audit-log";

export const vitalsRouter = Router();

const patientIdParamsSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
});

const createVitalSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
  type: z.enum(["BP", "GLUCOSE", "HEART_RATE", "WEIGHT"]),
  value: z.string().min(1).max(100),
  recordedAt: z.coerce.date(),
});

async function ensurePatientInTenant(patientId: string, clinicId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    select: { id: true },
  });
}

vitalsRouter.post("/", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = createVitalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const patient = await ensurePatientInTenant(parsed.data.patientId, req.clinicId);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  try {
    const vital = await prisma.vitalRecord.create({
      data: {
        patientId: parsed.data.patientId,
        type: parsed.data.type,
        value: parsed.data.value,
        recordedAt: parsed.data.recordedAt,
      },
    });

    await writeAuditLog(prisma, {
      userId: req.user.id,
      action: "VITAL_CREATE",
      entityType: "VITAL_RECORD",
      entityId: vital.id,
    });

    return res.status(201).json(vital);
  } catch {
    return res.status(500).json({ message: "Unable to create vital record" });
  }
});

vitalsRouter.get("/:patientId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
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

  const records = await prisma.vitalRecord.findMany({
    where: { patientId: parsedParams.data.patientId },
    orderBy: { recordedAt: "desc" },
  });

  return res.status(200).json(records);
});
