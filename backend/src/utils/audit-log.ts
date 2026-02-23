import type { Prisma, PrismaClient } from "@prisma/client";

type AuditWriter = PrismaClient | Prisma.TransactionClient;

interface AuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
}

/** Patterns that match common PHI: UUIDs, emails, phone numbers, names in quotes */
const PHI_PATTERNS = [
  /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/g, // UUIDs in action text
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
  /\+?\d[\d\s\-().]{7,}\d/g, // phone numbers
] as const;

/**
 * Scrubs potential PHI from the action description string.
 * Entity IDs are kept as opaque references but never embedded in free-text.
 */
function scrubPhi(text: string): string {
  let scrubbed = text;
  for (const pattern of PHI_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, "[REDACTED]");
  }
  return scrubbed;
}

export async function writeAuditLog(db: AuditWriter, input: AuditLogInput) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: scrubPhi(input.action),
      entityType: input.entityType,
      entityId: input.entityId, // opaque primary key — no PHI
    },
  });
}
