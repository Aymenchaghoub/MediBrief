import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { checkSubscriptionLimits, incrementAiUsage } from "../../middlewares/subscription.middleware";
import { enqueueAiSummaryJob, getAiSummaryJobStatus, subscribeToJobEvents } from "./queue";
import { buildStructuredInput } from "./service";
import { anonymizeForAi } from "./anonymizer";

export const aiRouter = Router();

const patientIdParamsSchema = z.object({
  patientId: z.string().uuid("Invalid patient id"),
});

aiRouter.post(
  "/generate-summary/:patientId",
  roleMiddleware(["ADMIN", "DOCTOR"]),
  checkSubscriptionLimits,
  async (req, res) => {
    if (!req.clinicId || !req.user?.id) {
      return res.status(403).json({ message: "Tenant context missing" });
    }

    const parsedParams = patientIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
    }

    const patientId = parsedParams.data.patientId;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.clinicId, isArchived: false },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    try {
      const jobId = await enqueueAiSummaryJob({
        clinicId: req.clinicId,
        patientId,
        userId: req.user.id,
      });

      await incrementAiUsage(req.clinicId);

      return res.status(202).json({
        message: "AI summary generation queued",
        status: "queued",
        jobId,
      });
    } catch {
      return res.status(503).json({ message: "AI queue service unavailable" });
    }
  },
);

const jobIdParamsSchema = z.object({
  jobId: z.string().min(1),
});

aiRouter.get("/jobs/:jobId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  const parsedParams = jobIdParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid job id", errors: parsedParams.error.flatten() });
  }

  const status = await getAiSummaryJobStatus(parsedParams.data.jobId);

  if (!status) {
    return res.status(404).json({ message: "AI generation job not found" });
  }

  return res.status(200).json(status);
});

/* ------------------------------------------------------------------ */
/*  SSE stream for real-time job status                                */
/* ------------------------------------------------------------------ */

aiRouter.get("/stream/:jobId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  const parsedParams = jobIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid job id", errors: parsedParams.error.flatten() });
  }

  const jobId = parsedParams.data.jobId;

  // Check if job already finished before opening stream
  const currentStatus = await getAiSummaryJobStatus(jobId);
  if (!currentStatus) {
    return res.status(404).json({ message: "AI generation job not found" });
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  // Send initial status
  res.write(`data: ${JSON.stringify({ state: currentStatus.state, summaryId: currentStatus.summaryId, failedReason: currentStatus.failedReason })}\n\n`);

  // If already terminal, close immediately
  if (currentStatus.state === "completed" || currentStatus.state === "failed") {
    res.end();
    return;
  }

  // Subscribe to Redis PubSub for real-time updates
  const { unsubscribe } = subscribeToJobEvents(jobId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    // Terminal event — close stream
    cleanup();
  });

  // Heartbeat to keep connection alive (every 15s)
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);

  // Safety timeout — close after 2 minutes regardless
  const timeout = setTimeout(() => {
    res.write(`data: ${JSON.stringify({ state: "timeout", summaryId: null, failedReason: "SSE stream timed out" })}\n\n`);
    cleanup();
  }, 120_000);

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    clearTimeout(timeout);
    unsubscribe().finally(() => res.end());
  }

  req.on("close", cleanup);
});

const summaryIdParamsSchema = z.object({
  summaryId: z.string().uuid("Invalid summary id"),
});

aiRouter.get("/summaries/patient/:patientId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = patientIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: parsedParams.data.patientId, clinicId: req.clinicId, isArchived: false },
    select: { id: true },
  });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const summaries = await prisma.aISummary.findMany({
    where: { patientId: patient.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return res.status(200).json(summaries);
});

aiRouter.get("/summaries/:summaryId", roleMiddleware(["ADMIN", "DOCTOR"]), async (req, res) => {
  if (!req.clinicId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const parsedParams = summaryIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: "Invalid summary id", errors: parsedParams.error.flatten() });
  }

  const summary = await prisma.aISummary.findFirst({
    where: {
      id: parsedParams.data.summaryId,
      patient: { clinicId: req.clinicId, isArchived: false },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!summary) {
    return res.status(404).json({ message: "Summary not found" });
  }

  return res.status(200).json(summary);
});

/* ─── RAG Chat: Ask questions about a patient's records ─── */

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
});

aiRouter.post(
  "/chat/:patientId",
  roleMiddleware(["ADMIN", "DOCTOR"]),
  checkSubscriptionLimits,
  async (req, res) => {
    if (!req.clinicId || !req.user?.id) {
      return res.status(403).json({ message: "Tenant context missing" });
    }

    const parsedParams = patientIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ message: "Invalid patient id", errors: parsedParams.error.flatten() });
    }

    const parsedBody = chatSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsedBody.error.flatten() });
    }

    const patientId = parsedParams.data.patientId;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.clinicId, isArchived: false },
    });

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Gather patient context
    const [vitals, labs, consultations] = await Promise.all([
      prisma.vitalRecord.findMany({
        where: { patientId, deletedAt: null },
        orderBy: { recordedAt: "desc" },
        take: 20,
      }),
      prisma.labResult.findMany({
        where: { patientId, deletedAt: null },
        orderBy: { recordedAt: "desc" },
        take: 15,
      }),
      prisma.consultation.findMany({
        where: { patientId, deletedAt: null },
        orderBy: { date: "desc" },
        take: 10,
      }),
    ]);

    const structuredInput = buildStructuredInput(patient, vitals, labs, consultations);
    const anonymizedContext = anonymizeForAi(structuredInput);

    if (!env.OPENAI_API_KEY) {
      return res.status(503).json({
        message: "AI service unavailable",
        answer: "The AI service is not configured. Please set OPENAI_API_KEY to enable chat functionality.",
      });
    }

    const client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
      defaultHeaders: {
        ...(env.OPENAI_HTTP_REFERER ? { "HTTP-Referer": env.OPENAI_HTTP_REFERER } : {}),
        ...(env.OPENAI_APP_NAME ? { "X-Title": env.OPENAI_APP_NAME } : {}),
      },
    });

    try {
      const response = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: [
              "You are a clinical records assistant for a healthcare professional.",
              "Below is the anonymized patient context. Answer questions based only on this data.",
              "Never diagnose. Summarize trends and highlight relevant observations.",
              "If the data does not contain the answer, say so.",
              "Always include: 'This is AI-generated support, not a clinical diagnosis.'",
              "",
              "=== PATIENT CONTEXT ===",
              JSON.stringify(anonymizedContext, null, 2),
            ].join("\n"),
          },
          {
            role: "user",
            content: parsedBody.data.message,
          },
        ],
      });

      const answer =
        response.choices?.[0]?.message?.content ??
        "Unable to generate a response. Please try again.";

      await incrementAiUsage(req.clinicId);

      return res.status(200).json({ answer });
    } catch {
      return res.status(500).json({ message: "AI chat request failed. Please try again." });
    }
  },
);
