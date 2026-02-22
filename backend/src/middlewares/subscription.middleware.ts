import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db";
import { env } from "../config/env";

function isSameBillingMonth(left: Date, right: Date) {
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}

function resolveMonthlyLimit(subscriptionPlan: string) {
  const normalized = subscriptionPlan.trim().toLowerCase();

  if (normalized.includes("enterprise")) {
    return env.AI_MONTHLY_LIMIT_ENTERPRISE;
  }

  if (normalized.includes("pro")) {
    return env.AI_MONTHLY_LIMIT_PRO;
  }

  return env.AI_MONTHLY_LIMIT_FREE;
}

async function getClinicUsageWindow(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, subscriptionPlan: true, aiCallCount: true, billingPeriodStart: true },
  });

  if (!clinic) {
    return null;
  }

  const now = new Date();

  if (!isSameBillingMonth(clinic.billingPeriodStart, now)) {
    const resetClinic = await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        aiCallCount: 0,
        billingPeriodStart: now,
      },
      select: {
        id: true,
        subscriptionPlan: true,
        aiCallCount: true,
      },
    });

    return resetClinic;
  }

  return clinic;
}

export async function hasRemainingAiQuota(clinicId: string) {
  const clinic = await getClinicUsageWindow(clinicId);

  if (!clinic) {
    return { found: false as const, monthlyLimit: 0 };
  }

  const monthlyLimit = resolveMonthlyLimit(clinic.subscriptionPlan);
  const hasQuota = clinic.aiCallCount < monthlyLimit;

  return {
    found: true as const,
    hasQuota,
    monthlyLimit,
  };
}

export async function incrementAiUsage(clinicId: string) {
  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      aiCallCount: { increment: 1 },
    },
  });
}

export async function checkSubscriptionLimits(req: Request, res: Response, next: NextFunction) {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const quota = await hasRemainingAiQuota(req.clinicId);

  if (!quota.found) {
    return res.status(404).json({ message: "Clinic not found" });
  }

  if (!quota.hasQuota) {
    return res.status(429).json({
      message: "Monthly AI summary limit reached for current subscription plan",
      monthlyLimit: quota.monthlyLimit,
    });
  }

  next();
}
