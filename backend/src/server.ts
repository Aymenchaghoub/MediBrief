import { app } from "./app";
import { prisma } from "./config/db";
import { env } from "./config/env";
import { stopAiQueueResources, startAiSummaryWorker } from "./modules/ai/queue";

startAiSummaryWorker();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API running on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  await Promise.all([prisma.$disconnect(), stopAiQueueResources()]);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
