import { Router } from "express";
import { authMiddleware } from "./middlewares/auth.middleware";
import { tenantMiddleware } from "./middlewares/tenant.middleware";
import { aiRouter } from "./modules/ai";
import { auditRouter } from "./modules/audit";
import { authRouter } from "./modules/auth";
import { clinicRouter } from "./modules/clinic";
import { consultationsRouter } from "./modules/consultations";
import { labsRouter } from "./modules/lab-results";
import { patientsRouter } from "./modules/patients";
import { usersRouter } from "./modules/users";
import { vitalsRouter } from "./modules/vitals";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);

apiRouter.use(authMiddleware, tenantMiddleware);
apiRouter.use("/clinic", clinicRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/patients", patientsRouter);
apiRouter.use("/vitals", vitalsRouter);
apiRouter.use("/labs", labsRouter);
apiRouter.use("/consultations", consultationsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/audit", auditRouter);
