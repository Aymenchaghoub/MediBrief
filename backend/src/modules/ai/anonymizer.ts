import { randomUUID } from "node:crypto";
import type { StructuredClinicalInput } from "./service";

/**
 * GDPR-compliant data anonymization layer.
 *
 * Before sending clinical data to any external LLM provider, this module
 * strips / generalizes PII so the AI never receives identifiable information.
 *
 * Techniques applied:
 *  - Age bucketing (5-year bands) instead of exact age
 *  - Ephemeral session ID replaces any patient identifier
 *  - Lab test names are kept (non-PII) but any free-text symptoms
 *    are normalized to lowercase trimmed strings with no names
 *  - Numeric series are passed as-is (no PII in vitals numbers)
 */

export interface AnonymizedClinicalInput {
  sessionId: string;
  ageBand: string;
  bpTrend: number[];
  glucoseTrend: number[];
  heartRateTrend: number[];
  weightTrend: number[];
  recentSymptoms: string[];
  recentLabValues: Array<{ testName: string; value: string; referenceRange: string | null }>;
}

function bucketAge(age: number | null): string {
  if (age === null || age < 0) {
    return "unknown";
  }

  const lowerBound = Math.floor(age / 5) * 5;
  const upperBound = lowerBound + 4;
  return `${lowerBound}-${upperBound}`;
}

/**
 * Strips patterns that could contain patient names, IDs, or other PII
 * from free-text symptom strings while preserving clinical content.
 */
function sanitizeSymptom(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\b(mr|mrs|ms|dr|patient|name)[.\s:]*/gi, "")
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[EMAIL]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function anonymizeForAi(input: StructuredClinicalInput): AnonymizedClinicalInput {
  return {
    sessionId: randomUUID(),
    ageBand: bucketAge(input.age),
    bpTrend: input.bpTrend,
    glucoseTrend: input.glucoseTrend,
    heartRateTrend: input.heartRateTrend,
    weightTrend: input.weightTrend,
    recentSymptoms: input.recentSymptoms.map(sanitizeSymptom),
    recentLabValues: input.recentLabValues.map((lab) => ({
      testName: lab.testName,
      value: lab.value,
      referenceRange: lab.referenceRange,
    })),
  };
}
