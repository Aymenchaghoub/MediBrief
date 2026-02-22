import { describe, expect, it } from "vitest";
import type { StructuredClinicalInput } from "./service";
import { anonymizeForAi } from "./anonymizer";

function makeClinicalInput(overrides: Partial<StructuredClinicalInput> = {}): StructuredClinicalInput {
  return {
    age: 43,
    bpTrend: [120, 125, 130],
    glucoseTrend: [90, 95],
    heartRateTrend: [72, 78],
    weightTrend: [70, 71],
    recentSymptoms: ["chest pain and dizziness", "fatigue after exercise"],
    recentLabValues: [
      { testName: "HbA1c", value: "6.8", referenceRange: "4.0-5.6" },
    ],
    ...overrides,
  };
}

describe("anonymizeForAi", () => {
  it("replaces exact age with a 5-year band", () => {
    const result = anonymizeForAi(makeClinicalInput({ age: 43 }));
    expect(result.ageBand).toBe("40-44");
  });

  it("handles edge age buckets correctly", () => {
    expect(anonymizeForAi(makeClinicalInput({ age: 0 })).ageBand).toBe("0-4");
    expect(anonymizeForAi(makeClinicalInput({ age: 25 })).ageBand).toBe("25-29");
    expect(anonymizeForAi(makeClinicalInput({ age: 99 })).ageBand).toBe("95-99");
  });

  it("returns 'unknown' when age is null", () => {
    const result = anonymizeForAi(makeClinicalInput({ age: null }));
    expect(result.ageBand).toBe("unknown");
  });

  it("assigns a unique sessionId (UUID format)", () => {
    const result = anonymizeForAi(makeClinicalInput());
    expect(result.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("generates different sessionIds per call", () => {
    const a = anonymizeForAi(makeClinicalInput());
    const b = anonymizeForAi(makeClinicalInput());
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it("lowercases and trims symptom text", () => {
    const result = anonymizeForAi(
      makeClinicalInput({ recentSymptoms: ["  CHEST PAIN  "] }),
    );
    expect(result.recentSymptoms[0]).toBe("chest pain");
  });

  it("redacts phone number patterns from symptoms", () => {
    const result = anonymizeForAi(
      makeClinicalInput({ recentSymptoms: ["Call 555-123-4567 for fatigue"] }),
    );
    expect(result.recentSymptoms[0]).not.toContain("555");
    expect(result.recentSymptoms[0]).toContain("[PHONE]");
  });

  it("redacts email patterns from symptoms", () => {
    const result = anonymizeForAi(
      makeClinicalInput({ recentSymptoms: ["Contact john@example.com about syncope"] }),
    );
    expect(result.recentSymptoms[0]).not.toContain("john@example.com");
    expect(result.recentSymptoms[0]).toContain("[EMAIL]");
  });

  it("passes numeric trends through unchanged", () => {
    const input = makeClinicalInput({
      bpTrend: [118, 120, 150],
      glucoseTrend: [92, 130],
    });
    const result = anonymizeForAi(input);
    expect(result.bpTrend).toEqual([118, 120, 150]);
    expect(result.glucoseTrend).toEqual([92, 130]);
  });

  it("passes lab values through unchanged", () => {
    const result = anonymizeForAi(makeClinicalInput());
    expect(result.recentLabValues).toEqual([
      { testName: "HbA1c", value: "6.8", referenceRange: "4.0-5.6" },
    ]);
  });
});
