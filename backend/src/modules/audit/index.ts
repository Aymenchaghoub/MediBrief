import { Router } from "express";

export const auditRouter = Router();

auditRouter.get("/", (_req, res) => {
  res.status(501).json({ message: "TODO: list audit logs" });
});
