import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { writeAuditLog } from "../../utils/audit-log";
import { invalidateAiStructuredInputCache } from "../ai/queue";

export const consultationsRouter = Router();

const patientIdParamsSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
});

const createConsultationSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
  date: z.coerce.date(),
  symptoms: z.string().min(1).max(5000),
  notes: z.string().min(1).max(10000),
});

async function ensurePatientInTenant(patientId: string, clinicId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, clinicId, isArchived: false },
    select: { id: true },
  });
}

consultationsRouter.post("/", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = createConsultationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const patient = await ensurePatientInTenant(parsed.data.patientId, req.clinicId);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  try {
    const consultation = await prisma.consultation.create({
      data: {
        patientId: parsed.data.patientId,
        doctorId: req.user.id,
        date: parsed.data.date,
        symptoms: parsed.data.symptoms,
        notes: parsed.data.notes,
      },
    });

    await writeAuditLog(prisma, {
      userId: req.user.id,
      action: "CONSULTATION_CREATE",
      entityType: "CONSULTATION",
      entityId: consultation.id,
    });

    await invalidateAiStructuredInputCache(parsed.data.patientId);

    return res.status(201).json(consultation);
  } catch {
    return res.status(500).json({ message: "Unable to create consultation" });
  }
});

const cursorPaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

consultationsRouter.get("/:patientId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
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

  const parsed = cursorPaginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params", errors: parsed.error.flatten() });
  }

  const { cursor, limit } = parsed.data;

  const consultations = await prisma.consultation.findMany({
    where: { patientId: parsedParams.data.patientId },
    orderBy: { date: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const hasMore = consultations.length > limit;
  const data = hasMore ? consultations.slice(0, limit) : consultations;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return res.status(200).json({ data, nextCursor });
});
