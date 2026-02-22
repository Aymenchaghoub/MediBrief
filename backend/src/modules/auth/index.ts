import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../config/db";
import { env } from "../../config/env";

export const authRouter = Router();

const registerClinicSchema = z.object({
  clinicName: z.string().min(2),
  clinicEmail: z.string().email(),
  subscriptionPlan: z.string().min(2),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const tokenExpiresIn = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];

authRouter.post("/register-clinic", async (req, res) => {
  const parsed = registerClinicSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const { clinicEmail, clinicName, subscriptionPlan, adminEmail, adminName, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  const existingClinic = await prisma.clinic.findUnique({ where: { email: clinicEmail } });

  if (existing) {
    return res.status(409).json({ message: "Admin email already in use" });
  }

  if (existingClinic) {
    return res.status(409).json({ message: "Clinic email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: clinicName,
          email: clinicEmail,
          subscriptionPlan,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          clinicId: clinic.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: "REGISTER_CLINIC",
          entityType: "CLINIC",
          entityId: clinic.id,
        },
      });

      return { clinic, adminUser };
    });

    const token = jwt.sign(
      { id: result.adminUser.id, clinicId: result.clinic.id, role: result.adminUser.role },
      env.JWT_SECRET,
      { expiresIn: tokenExpiresIn },
    );

    return res.status(201).json({
      message: "Clinic registered successfully",
      token,
      user: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
        role: result.adminUser.role,
        clinicId: result.clinic.id,
      },
    });
  } catch {
    return res.status(500).json({ message: "Unable to register clinic" });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  try {
    const token = jwt.sign(
      { id: user.id, clinicId: user.clinicId, role: user.role },
      env.JWT_SECRET,
      { expiresIn: tokenExpiresIn },
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entityType: "USER",
        entityId: user.id,
      },
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch {
    return res.status(500).json({ message: "Unable to complete login" });
  }
});
