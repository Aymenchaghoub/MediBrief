import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { writeAuditLog } from "../../utils/audit-log";

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

patientsRouter.get("/", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const patients = await prisma.patient.findMany({
    where: { clinicId: req.clinicId },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(patients);
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
    where: { id: parsedParams.data.id, clinicId: req.clinicId },
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
    where: { id: parsedParams.data.id, clinicId: req.clinicId },
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

    return res.status(200).json(updatedPatient);
  } catch {
    return res.status(500).json({ message: "Unable to update patient" });
  }
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
    where: { id: parsedParams.data.id, clinicId: req.clinicId },
    select: { id: true },
  });

  if (!existingPatient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  try {
    await prisma.patient.delete({ where: { id: existingPatient.id } });
    await writePatientAuditLog(req.user.id, "PATIENT_DELETE", existingPatient.id);

    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: "Unable to delete patient" });
  }
});
