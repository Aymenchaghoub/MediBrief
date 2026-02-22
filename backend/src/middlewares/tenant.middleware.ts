import type { NextFunction, Request, Response } from "express";

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  next();
}
