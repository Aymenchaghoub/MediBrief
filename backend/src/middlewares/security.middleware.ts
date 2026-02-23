import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export function isHttpsRequest(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];

  if (req.secure) {
    return true;
  }

  if (Array.isArray(forwardedProto)) {
    return forwardedProto.includes("https");
  }

  return forwardedProto === "https";
}

export function shouldRejectInsecureRequest(options: {
  requireHttps: boolean;
  nodeEnv: string;
  isHttps: boolean;
}) {
  return options.requireHttps && options.nodeEnv === "production" && !options.isHttps;
}

export function requireHttpsInProduction(req: Request, res: Response, next: NextFunction) {
  if (
    shouldRejectInsecureRequest({
      requireHttps: env.REQUIRE_HTTPS,
      nodeEnv: env.NODE_ENV,
      isHttps: isHttpsRequest(req),
    })
  ) {
    return res.status(400).json({ message: "HTTPS is required" });
  }

  return next();
}

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please retry later.",
  },
});

/* ------------------------------------------------------------------ */
/*  Strict per-route rate limiters                                     */
/* ------------------------------------------------------------------ */

/** Auth endpoints: 10 requests per minute per IP */
export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please wait and try again." },
});

/** AI generation endpoints: 5 requests per minute per IP */
export const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "AI generation rate limit exceeded. Please wait before generating another summary." },
});

/* ------------------------------------------------------------------ */
/*  Strict CORS origin validation                                      */
/* ------------------------------------------------------------------ */

/**
 * In production, reject localhost/127.0.0.1 CORS origins.
 * Returns the validated origin string or the raw value
 * (Express CORS middleware handles the allow/deny logic).
 */
export function validateCorsOrigin(origin: string, nodeEnv: string): boolean {
  if (nodeEnv !== "production") return true;
  const lower = origin.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1") || lower.includes("0.0.0.0")) {
    return false;
  }
  return true;
}
