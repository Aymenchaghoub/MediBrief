import IORedis from "ioredis";
import { env } from "./env";

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as const;

export const redisCacheClient = new IORedis(env.REDIS_URL, redisOptions);

redisCacheClient.on("error", () => {
  // Keep Redis failures non-fatal for HTTP request handling.
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
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds: number) {
  try {
    await redisCacheClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Intentionally swallow cache failures.
  }
}

export async function deleteCacheKey(key: string) {
  try {
    await redisCacheClient.del(key);
  } catch {
    // Intentionally swallow cache failures.
  }
}
