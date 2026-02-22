import type { NextFunction, Request, Response } from "express";
import type { AuthRole } from "./auth.middleware";

export function roleMiddleware(allowedRoles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}
