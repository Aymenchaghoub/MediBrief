import { Queue, QueueEvents, Worker } from "bullmq";
import { prisma } from "../../config/db";
import { createRedisConnection, deleteCacheKey, getCachedJson, redisCacheClient, setCachedJson } from "../../config/redis";
import { env } from "../../config/env";
import { writeAuditLog } from "../../utils/audit-log";
import { buildStructuredInput, generateClinicalSummary, type StructuredClinicalInput } from "./service";

interface GenerateSummaryJobData {
  clinicId: string;
  patientId: string;
  userId: string;
}

interface GenerateSummaryJobResult {
  summaryId: string;
}

const queueName = "ai-summary-generation";
const structuredInputTtlSeconds = 60 * 5;

const bullConnection = {
  url: env.REDIS_URL,
};

const aiSummaryQueue = new Queue<GenerateSummaryJobData, GenerateSummaryJobResult, "generate">(queueName, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

const aiSummaryEvents = new QueueEvents(queueName, { connection: bullConnection });

let aiSummaryWorker: Worker<GenerateSummaryJobData, GenerateSummaryJobResult, "generate"> | null = null;

function structuredInputCacheKey(patientId: string) {
  return `ai:structured-input:${patientId}`;
}

export async function invalidateAiStructuredInputCache(patientId: string) {
  await deleteCacheKey(structuredInputCacheKey(patientId));
}

async function getStructuredInputWithCache(data: GenerateSummaryJobData) {
  const cacheKey = structuredInputCacheKey(data.patientId);
  const cached = await getCachedJson<StructuredClinicalInput>(cacheKey);

  if (cached) {
    return cached;
  }

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, clinicId: data.clinicId, isArchived: false },
  });

  if (!patient) {
    throw new Error("Patient not found");
  }

  const [vitals, labs, consultations] = await Promise.all([
    prisma.vitalRecord.findMany({ where: { patientId: data.patientId, deletedAt: null }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.labResult.findMany({ where: { patientId: data.patientId, deletedAt: null }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.consultation.findMany({ where: { patientId: data.patientId, deletedAt: null }, orderBy: { date: "desc" }, take: 10 }),
  ]);

  const structuredInput = buildStructuredInput(patient, vitals, labs, consultations);
  await setCachedJson(cacheKey, structuredInput, structuredInputTtlSeconds);

  return structuredInput;
}

/* ------------------------------------------------------------------ */
/*  Redis PubSub channel helpers for SSE                               */
/* ------------------------------------------------------------------ */

function jobChannel(jobId: string) {
  return `ai:job-events:${jobId}`;
}

export interface JobEvent {
  state: "completed" | "failed";
  summaryId: string | null;
  failedReason: string | null;
}

async function publishJobEvent(jobId: string, event: JobEvent) {
  try {
    await redisCacheClient.publish(jobChannel(jobId), JSON.stringify(event));
  } catch {
    // Non-fatal — SSE clients will fall back to final status query.
  }
}

/**
 * Subscribe to job completion events. Returns a cleanup function.
 * Used by the SSE endpoint to push real-time updates.
 */
export function subscribeToJobEvents(
  jobId: string,
  onEvent: (event: JobEvent) => void,
): { unsubscribe: () => Promise<void> } {
  const sub = createRedisConnection();
  const channel = jobChannel(jobId);

  sub.subscribe(channel).catch(() => {});
  sub.on("message", (_ch: string, message: string) => {
    try {
      onEvent(JSON.parse(message) as JobEvent);
    } catch { /* ignore malformed */ }
  });

  return {
    async unsubscribe() {
      try {
        await sub.unsubscribe(channel);
        sub.disconnect();
      } catch { /* best effort */ }
    },
  };
}

async function processSummaryJob(data: GenerateSummaryJobData): Promise<GenerateSummaryJobResult> {
  const structuredInput = await getStructuredInputWithCache(data);
  const generated = await generateClinicalSummary(structuredInput);

  const summary = await prisma.aISummary.create({
    data: {
      patientId: data.patientId,
      summaryText: generated.summaryText,
      riskFlags: generated.riskFlags,
    },
  });

  await writeAuditLog(prisma, {
    userId: data.userId,
    action: "AI_SUMMARY_GENERATE",
    entityType: "AI_SUMMARY",
    entityId: summary.id,
  });

  return {
    summaryId: summary.id,
  };
}

export function startAiSummaryWorker() {
  if (aiSummaryWorker) {
    return;
  }

  aiSummaryWorker = new Worker<GenerateSummaryJobData, GenerateSummaryJobResult, "generate">(
    queueName,
    async (job) => processSummaryJob(job.data),
    { connection: bullConnection, concurrency: 2 },
  );

  aiSummaryWorker.on("completed", (job, result) => {
    if (job.id) {
      publishJobEvent(String(job.id), { state: "completed", summaryId: result.summaryId, failedReason: null });
    }
  });

  aiSummaryWorker.on("failed", (job, error) => {
    if (job?.id) {
      publishJobEvent(String(job.id), { state: "failed", summaryId: null, failedReason: error?.message ?? "Unknown error" });
    }
  });
}

export async function enqueueAiSummaryJob(data: GenerateSummaryJobData) {
  const job = await Promise.race([
    aiSummaryQueue.add("generate", data),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Queue unavailable")), 2500);
    }),
  ]);

  return String(job.id);
}

export async function getAiSummaryJobStatus(jobId: string) {
  const job = await aiSummaryQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const result = (job.returnvalue ?? null) as GenerateSummaryJobResult | null;

  return {
    jobId,
    state,
    failedReason: job.failedReason ?? null,
    summaryId: result?.summaryId ?? null,
  };
}

export async function stopAiQueueResources() {
  await Promise.all([
    aiSummaryWorker?.close(),
    aiSummaryEvents.close(),
    aiSummaryQueue.close(),
  ]);
}
