import { app } from "./app";
import { prisma } from "./config/db";
import { env } from "./config/env";

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API running on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
