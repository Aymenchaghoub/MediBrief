import { Router } from "express";
import { authMiddleware } from "./middlewares/auth.middleware";
import { tenantMiddleware } from "./middlewares/tenant.middleware";
import { aiRouter } from "./modules/ai";
import { analyticsRouter } from "./modules/analytics";
import { auditRouter } from "./modules/audit";
import { authRouter } from "./modules/auth";
import { clinicRouter } from "./modules/clinic";
import { consultationsRouter } from "./modules/consultations";
import { labsRouter } from "./modules/lab-results";
import { patientAuthRouter } from "./modules/patient-auth";
import { patientsRouter } from "./modules/patients";
import { portalRouter } from "./modules/portal";
import { usersRouter } from "./modules/users";
import { vitalsRouter } from "./modules/vitals";

export const apiRouter = Router();

// Public routes
apiRouter.use("/auth", authRouter);
apiRouter.use("/auth", patientAuthRouter);

// Patient portal (has own auth middleware inside)
apiRouter.use("/portal", portalRouter);

// Staff routes (auth + tenant isolation)
apiRouter.use(authMiddleware, tenantMiddleware);
apiRouter.use("/clinic", clinicRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/patients", patientsRouter);
apiRouter.use("/vitals", vitalsRouter);
apiRouter.use("/labs", labsRouter);
apiRouter.use("/consultations", consultationsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/audit", auditRouter);
