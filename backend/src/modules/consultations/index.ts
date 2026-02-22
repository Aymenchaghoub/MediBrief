import { Router } from "express";

export const consultationsRouter = Router();

consultationsRouter.post("/", (_req, res) => {
  res.status(501).json({ message: "TODO: create consultation" });
});

consultationsRouter.get("/:patientId", (_req, res) => {
  res.status(501).json({ message: "TODO: list consultations" });
});
