import OpenAI from "openai";
import { env } from "./env";

/**
 * Singleton OpenAI client instance.
 * Reuses HTTP connections across requests instead of creating a new client per call.
 * Returns null if OPENAI_API_KEY is not configured.
 */
function createOpenAiClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    defaultHeaders: {
      ...(env.OPENAI_HTTP_REFERER ? { "HTTP-Referer": env.OPENAI_HTTP_REFERER } : {}),
      ...(env.OPENAI_APP_NAME ? { "X-Title": env.OPENAI_APP_NAME } : {}),
    },
  });
}

export const openaiClient = createOpenAiClient();
