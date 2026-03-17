import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthRole = "ADMIN" | "DOCTOR" | "PATIENT";

export interface AuthUser {
  id: string;
  clinicId: string;
  role: AuthRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      clinicId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Only accept tokens via Authorization: Bearer header.
  // Query-string tokens are rejected to prevent token leakage in logs and browser history.
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
    req.clinicId = payload.clinicId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
