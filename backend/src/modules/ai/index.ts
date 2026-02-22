import { Router } from "express";

export const aiRouter = Router();

aiRouter.post("/generate-summary/:patientId", (_req, res) => {
  res.status(501).json({ message: "TODO: generate AI summary" });
});
