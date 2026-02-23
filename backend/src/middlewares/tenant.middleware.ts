import type { NextFunction, Request, Response } from "express";
import { setRlsClinicId } from "../config/db";

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  // Set PostgreSQL RLS session variable for row-level tenant isolation
  setRlsClinicId(req.clinicId).then(() => next()).catch(next);
}
