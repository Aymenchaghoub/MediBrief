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
