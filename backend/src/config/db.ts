import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "./env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

/**
 * Sets the PostgreSQL session variable `app.clinic_id` for RLS enforcement.
 * Must be called at the start of every request that accesses tenant-scoped data.
 */
export async function setRlsClinicId(clinicId: string) {
  await prisma.$executeRawUnsafe(`SET LOCAL app.clinic_id = '${clinicId.replace(/'/g, "''")}';`);
}
