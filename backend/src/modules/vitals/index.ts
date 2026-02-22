import { Router } from "express";

export const vitalsRouter = Router();

vitalsRouter.post("/", (_req, res) => {
  res.status(501).json({ message: "TODO: create vital record" });
});

vitalsRouter.get("/:patientId", (_req, res) => {
  res.status(501).json({ message: "TODO: list vital records" });
});
