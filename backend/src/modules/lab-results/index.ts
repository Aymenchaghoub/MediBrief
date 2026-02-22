import { Router } from "express";

export const labsRouter = Router();

labsRouter.post("/", (_req, res) => {
  res.status(501).json({ message: "TODO: create lab result" });
});

labsRouter.get("/:patientId", (_req, res) => {
  res.status(501).json({ message: "TODO: list lab results" });
});
