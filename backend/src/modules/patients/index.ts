import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { writeAuditLog } from "../../utils/audit-log";
import { invalidateAiStructuredInputCache } from "../ai/queue";

export const patientsRouter = Router();

const patientIdSchema = z.object({
  id: z.string().uuid("Invalid patient id"),
});

const createPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(6).max(30).optional(),
});

const updatePatientSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    phone: z.string().min(6).max(30).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

async function writePatientAuditLog(userId: string, action: string, patientId: string) {
  await writeAuditLog(prisma, {
    userId,
    action,
    entityType: "PATIENT",
    entityId: patientId,
  });
}

const cursorPaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

patientsRouter.get("/", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = cursorPaginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params", errors: parsed.error.flatten() });
  }

  const { cursor, limit } = parsed.data;

  const patients = await prisma.patient.findMany({
    where: { clinicId: req.clinicId, isArchived: false },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = patients.length > limit;
  const data = hasMore ? patients.slice(0, limit) : patients;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return res.status(200).json({ data, nextCursor });
});

patientsRouter.post("/", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = createPatientSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        clinicId: req.clinicId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth,
        gender: parsed.data.gender,
        phone: parsed.data.phone,
      },
    });

    await writePatientAuditLog(req.user.id, "PATIENT_CREATE", patient.id);

    return res.status(201).json(patient);
  } catch {
    return res.status(500).json({ message: "Unable to create patient" });
  }
});

patientsRouter.get("/:id", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: parsedParams.data.id, clinicId: req.clinicId, isArchived: false },
  });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  return res.status(200).json(patient);
});

patientsRouter.put("/:id", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const parsedBody = updatePatientSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsedBody.error.flatten() });
  }

  const existingPatient = await prisma.patient.findFirst({
    where: { id: parsedParams.data.id, clinicId: req.clinicId, isArchived: false },
    select: { id: true },
  });

  if (!existingPatient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  try {
    const updatedPatient = await prisma.patient.update({
      where: { id: existingPatient.id },
      data: parsedBody.data,
    });

    await writePatientAuditLog(req.user.id, "PATIENT_UPDATE", updatedPatient.id);
    await invalidateAiStructuredInputCache(updatedPatient.id);

    return res.status(200).json(updatedPatient);
  } catch {
    return res.status(500).json({ message: "Unable to update patient" });
  }
});

/* ------------------------------------------------------------------ */
/*  Generate portal invite link                                        */
/* ------------------------------------------------------------------ */

patientsRouter.post("/:id/invite", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: parsedParams.data.id, clinicId: req.clinicId, isArchived: false },
  });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  if (patient.passwordHash) {
    return res.status(409).json({ message: "Patient already has portal access" });
  }

  const inviteToken = crypto.randomUUID();
  const inviteExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await prisma.patient.update({
    where: { id: patient.id },
    data: { inviteToken, inviteExpiresAt },
  });

  await writePatientAuditLog(req.user.id, "PATIENT_INVITE", patient.id);

  return res.status(200).json({
    inviteToken,
    inviteExpiresAt,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });
});

patientsRouter.delete("/:id", roleMiddleware(["ADMIN"]), async (req, res) => {
  if (!req.clinicId || !req.user?.id) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const existingPatient = await prisma.patient.findFirst({
    where: { id: parsedParams.data.id, clinicId: req.clinicId, isArchived: false },
    select: { id: true },
  });

  if (!existingPatient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  try {
    await prisma.patient.update({
      where: { id: existingPatient.id },
      data: { isArchived: true },
    });
    await writePatientAuditLog(req.user.id, "PATIENT_ARCHIVE", existingPatient.id);
    await invalidateAiStructuredInputCache(existingPatient.id);

    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: "Unable to delete patient" });
  }
});
