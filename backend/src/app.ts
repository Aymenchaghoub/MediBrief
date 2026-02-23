import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { swaggerSpec } from "./docs/swagger";
import { apiRateLimiter, requireHttpsInProduction, validateCorsOrigin } from "./middlewares/security.middleware";
import { apiRouter } from "./routes";
import swaggerUi from "swagger-ui-express";

export const app = express();

app.set("trust proxy", 1);

app.use(helmet());

/* Strict CORS: reject localhost origins in production */
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.includes(origin) && validateCorsOrigin(origin, env.NODE_ENV);
      if (isAllowed) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(requireHttpsInProduction);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "medibrief-backend" });
});

if (env.SWAGGER_ENABLED) {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use("/api", apiRateLimiter, apiRouter);
