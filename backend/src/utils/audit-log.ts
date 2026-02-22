import type { Prisma, PrismaClient } from "@prisma/client";

type AuditWriter = PrismaClient | Prisma.TransactionClient;

interface AuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
}

export async function writeAuditLog(db: AuditWriter, input: AuditLogInput) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}
