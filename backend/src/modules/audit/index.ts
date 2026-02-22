import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { roleMiddleware } from "../../middlewares/role.middleware";

export const auditRouter = Router();

const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().uuid().optional(),
});

auditRouter.get("/", roleMiddleware(["ADMIN"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsed = listAuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query", errors: parsed.error.flatten() });
  }

  const { page, limit, action, entityType, userId } = parsed.data;

  const clinicUsers = await prisma.user.findMany({
    where: { clinicId: req.clinicId },
    select: { id: true },
  });

  const clinicUserIds = clinicUsers.map((user) => user.id);

  if (clinicUserIds.length === 0) {
    return res.status(200).json({
      page,
      limit,
      total: 0,
      records: [],
    });
  }

  if (userId && !clinicUserIds.includes(userId)) {
    return res.status(200).json({
      page,
      limit,
      total: 0,
      records: [],
    });
  }

  const where = {
    userId: userId ?? { in: clinicUserIds },
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [total, records] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    page,
    limit,
    total,
    records,
  });
});
