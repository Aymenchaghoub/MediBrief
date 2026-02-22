import { Router } from "express";
import { prisma } from "../../config/db";

export const clinicRouter = Router();

clinicRouter.get("/me", async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: req.clinicId },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptionPlan: true,
      aiCallCount: true,
      billingPeriodStart: true,
      createdAt: true,
    },
  });

  if (!clinic) {
    return res.status(404).json({ message: "Clinic not found" });
  }

  return res.status(200).json(clinic);
});
