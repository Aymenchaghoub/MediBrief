import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../config/db";
import { env } from "../../config/env";

export const patientAuthRouter = Router();

const tokenExpiresIn = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];

/* ------------------------------------------------------------------ */
/*  Patient account setup (invite flow)                                */
/*  The clinic creates the patient, then shares a setup link.          */
/*  Patient visits setup link and sets email + password.               */
/* ------------------------------------------------------------------ */

const setupSchema = z.object({
  inviteToken: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
});

patientAuthRouter.post("/patient-setup", async (req, res) => {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const { inviteToken, email, password } = parsed.data;

  const patient = await prisma.patient.findUnique({ where: { inviteToken } });
  if (!patient || patient.isArchived) {
    return res.status(404).json({ message: "Invalid or expired invite link" });
  }

  if (patient.passwordHash) {
    return res.status(409).json({ message: "Account already set up. Please login." });
  }

  if (patient.inviteExpiresAt && patient.inviteExpiresAt < new Date()) {
    return res.status(410).json({ message: "Invite link has expired. Ask your clinic for a new one." });
  }

  // Check email uniqueness
  const emailTaken = await prisma.patient.findUnique({ where: { email } });
  if (emailTaken) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.patient.update({
    where: { id: patient.id },
    data: { email, passwordHash, inviteToken: null, inviteExpiresAt: null },
  });

  const token = jwt.sign(
    { id: patient.id, clinicId: patient.clinicId, role: "PATIENT" as const },
    env.JWT_SECRET,
    { expiresIn: tokenExpiresIn },
  );

  return res.status(200).json({
    message: "Account created successfully",
    token,
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email,
      role: "PATIENT",
    },
  });
});

/* ------------------------------------------------------------------ */
/*  Patient login                                                      */
/* ------------------------------------------------------------------ */

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

patientAuthRouter.post("/patient-login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const patient = await prisma.patient.findUnique({ where: { email } });
  if (!patient || patient.isArchived || !patient.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, patient.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: patient.id, clinicId: patient.clinicId, role: "PATIENT" as const },
    env.JWT_SECRET,
    { expiresIn: tokenExpiresIn },
  );

  return res.status(200).json({
    message: "Login successful",
    token,
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      role: "PATIENT",
    },
  });
});
