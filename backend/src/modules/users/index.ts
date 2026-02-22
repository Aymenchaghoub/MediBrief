import { Router } from "express";
import { prisma } from "../../config/db";

export const usersRouter = Router();

usersRouter.get("/me", async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      clinicId: true,
      name: true,
      email: true,
      role: true,
      isArchived: true,
      createdAt: true,
    },
  });

  if (!user || user.isArchived) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json(user);
});
