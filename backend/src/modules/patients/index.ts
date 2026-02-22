import { Router } from "express";

export const patientsRouter = Router();

patientsRouter.get("/", (_req, res) => {
  res.status(501).json({ message: "TODO: list patients" });
});

patientsRouter.post("/", (_req, res) => {
  res.status(501).json({ message: "TODO: create patient" });
});

patientsRouter.get("/:id", (_req, res) => {
  res.status(501).json({ message: "TODO: get patient" });
});

patientsRouter.put("/:id", (_req, res) => {
  res.status(501).json({ message: "TODO: update patient" });
});

patientsRouter.delete("/:id", (_req, res) => {
  res.status(501).json({ message: "TODO: delete patient" });
});
