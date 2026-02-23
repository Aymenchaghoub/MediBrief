import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../../config/db";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  buildPatientVitalsAnalytics,
  flagAllLabResults,
} from "../analytics/service";

export const portalRouter = Router();

// All portal routes require auth — the patient middleware checks role === "PATIENT"
portalRouter.use(authMiddleware, (req, res, next) => {
  if (req.user?.role !== "PATIENT") {
    return res.status(403).json({ message: "Patient access only" });
  }
  next();
});

/* ------------------------------------------------------------------ */
/*  GET /portal/me — Patient profile                                   */
/* ------------------------------------------------------------------ */

portalRouter.get("/me", async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      email: true,
      createdAt: true,
      clinic: { select: { name: true } },
    },
  });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  return res.status(200).json(patient);
});

/* ------------------------------------------------------------------ */
/*  PUT /portal/me — Update patient profile (phone)                    */
/* ------------------------------------------------------------------ */

const updateProfileSchema = z.object({
  phone: z.string().min(1).max(30).optional(),
});

portalRouter.put("/me", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const updated = await prisma.patient.update({
    where: { id: req.user!.id },
    data: { ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}) },
    select: { id: true, phone: true },
  });

  return res.status(200).json({ message: "Profile updated", ...updated });
});

/* ------------------------------------------------------------------ */
/*  PUT /portal/security — Change patient password                     */
/* ------------------------------------------------------------------ */

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

portalRouter.put("/security", async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: req.user!.id },
    select: { passwordHash: true },
  });

  if (!patient?.passwordHash) {
    return res.status(400).json({ message: "Account not set up for password auth" });
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, patient.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.patient.update({
    where: { id: req.user!.id },
    data: { passwordHash: newHash },
  });

  return res.status(200).json({ message: "Password updated successfully" });
});

/* ------------------------------------------------------------------ */
/*  GET /portal/vitals — Patient's vital records                       */
/* ------------------------------------------------------------------ */

portalRouter.get("/vitals", async (req, res) => {
  const vitals = await prisma.vitalRecord.findMany({
    where: { patientId: req.user!.id, deletedAt: null },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });

  return res.status(200).json(vitals);
});

/* ------------------------------------------------------------------ */
/*  GET /portal/vitals/analytics — Vital trends for patient            */
/* ------------------------------------------------------------------ */

portalRouter.get("/vitals/analytics", async (req, res) => {
  const vitals = await prisma.vitalRecord.findMany({
    where: { patientId: req.user!.id, deletedAt: null },
    orderBy: { recordedAt: "asc" },
    take: 200,
  });

  const analytics = buildPatientVitalsAnalytics(vitals);
  return res.status(200).json(analytics);
});

/* ------------------------------------------------------------------ */
/*  GET /portal/labs — Patient's lab results                           */
/* ------------------------------------------------------------------ */

portalRouter.get("/labs", async (req, res) => {
  const labs = await prisma.labResult.findMany({
    where: { patientId: req.user!.id, deletedAt: null },
    orderBy: { recordedAt: "desc" },
    take: 50,
  });

  const flagged = flagAllLabResults(labs);
  return res.status(200).json(flagged);
});

/* ------------------------------------------------------------------ */
/*  GET /portal/appointments — Patient's consultations (RDV)           */
/* ------------------------------------------------------------------ */

portalRouter.get("/appointments", async (req, res) => {
  const consultations = await prisma.consultation.findMany({
    where: { patientId: req.user!.id, deletedAt: null },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      doctor: { select: { name: true } },
    },
  });

  const appointments = consultations.map((c) => ({
    id: c.id,
    date: c.date,
    symptoms: c.symptoms,
    notes: c.notes,
    doctorName: c.doctor.name,
    createdAt: c.createdAt,
  }));

  return res.status(200).json(appointments);
});

/* ------------------------------------------------------------------ */
/*  GET /portal/summaries — Patient's AI summaries                     */
/* ------------------------------------------------------------------ */

portalRouter.get("/summaries", async (req, res) => {
  const summaries = await prisma.aISummary.findMany({
    where: { patientId: req.user!.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      summaryText: true,
      createdAt: true,
    },
  });

  return res.status(200).json(summaries);
});
