import IORedis from "ioredis";
import { env } from "./env";

/**
 * Detect TLS from URL scheme (rediss://) — required for Upstash and other
 * managed Redis providers that mandate encrypted connections.
 */
const useTls = env.REDIS_URL.startsWith("rediss://");

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
} as const;

export const redisCacheClient = new IORedis(env.REDIS_URL, redisOptions);

redisCacheClient.on("error", (err) => {
  console.warn("[Redis] Connection error (non-fatal):", err.message);
});

export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, redisOptions);
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const payload = await redisCacheClient.get(key);

    if (!payload) {
      return null;
    }

    return JSON.parse(payload) as T;
  } catch (err) {
    console.warn("[Redis] Cache read failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds: number) {
  try {
    await redisCacheClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.warn("[Redis] Cache write failed:", err instanceof Error ? err.message : err);
  }
}

export async function deleteCacheKey(key: string) {
  try {
    await redisCacheClient.del(key);
  } catch (err) {
    console.warn("[Redis] Cache delete failed:", err instanceof Error ? err.message : err);
  }
}
