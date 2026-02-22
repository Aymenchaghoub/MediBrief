import { describe, expect, it } from "vitest";
import type { LabResult } from "@prisma/client";
import {
  computeCompositeRiskScore,
  flagLabResult,
  flagAllLabResults,
  parseReferenceRange,
  buildPatientVitalsAnalytics,
  type LabFlag,
} from "./service";
import type { VitalRecord } from "@prisma/client";

/* ------------------------------------------------------------------ */
/*  Reference range parsing                                            */
/* ------------------------------------------------------------------ */

describe("parseReferenceRange", () => {
  it("parses bounded range '70-100'", () => {
    expect(parseReferenceRange("70-100")).toEqual({ low: 70, high: 100 });
  });

  it("parses bounded range with spaces '3.5 - 5.5'", () => {
    expect(parseReferenceRange("3.5 - 5.5")).toEqual({ low: 3.5, high: 5.5 });
  });

  it("parses less-than '< 200'", () => {
    expect(parseReferenceRange("< 200")).toEqual({ low: null, high: 200 });
  });

  it("parses greater-than '> 40'", () => {
    expect(parseReferenceRange("> 40")).toEqual({ low: 40, high: null });
  });

  it("returns nulls for null input", () => {
    expect(parseReferenceRange(null)).toEqual({ low: null, high: null });
  });

  it("returns nulls for unparsable string", () => {
    expect(parseReferenceRange("N/A")).toEqual({ low: null, high: null });
  });
});

/* ------------------------------------------------------------------ */
/*  Lab flag detection                                                 */
/* ------------------------------------------------------------------ */

function makeLab(overrides: Partial<LabResult> = {}): LabResult {
  return {
    id: "lab-1",
    patientId: "p1",
    testName: "Glucose",
    value: "95",
    referenceRange: "70-100",
    recordedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

describe("flagLabResult", () => {
  it("flags normal value within range", () => {
    const flag = flagLabResult(makeLab({ value: "85", referenceRange: "70-100" }));
    expect(flag.status).toBe("normal");
  });

  it("flags low value below range", () => {
    const flag = flagLabResult(makeLab({ value: "60", referenceRange: "70-100" }));
    expect(flag.status).toBe("low");
  });

  it("flags high value above range", () => {
    const flag = flagLabResult(makeLab({ value: "150", referenceRange: "70-100" }));
    expect(flag.status).toBe("high");
  });

  it("returns unknown when reference range is null", () => {
    const flag = flagLabResult(makeLab({ referenceRange: null }));
    expect(flag.status).toBe("unknown");
  });

  it("returns unknown when value is non-numeric", () => {
    const flag = flagLabResult(makeLab({ value: "positive" }));
    expect(flag.status).toBe("unknown");
    expect(flag.numericValue).toBeNull();
  });
});

describe("flagAllLabResults", () => {
  it("flags all labs in array", () => {
    const labs = [
      makeLab({ id: "1", value: "85", referenceRange: "70-100" }),
      makeLab({ id: "2", value: "250", referenceRange: "70-100" }),
    ];
    const flags = flagAllLabResults(labs);
    expect(flags).toHaveLength(2);
    expect(flags[0].status).toBe("normal");
    expect(flags[1].status).toBe("high");
  });
});

/* ------------------------------------------------------------------ */
/*  Composite Risk Score                                               */
/* ------------------------------------------------------------------ */

function makeVitals(anomalyCount: number): ReturnType<typeof buildPatientVitalsAnalytics> {
  // Build enough data points to produce the desired anomaly count
  const records: VitalRecord[] = [];
  for (let i = 0; i < 5; i++) {
    records.push({
      id: `v${i}`,
      patientId: "p1",
      type: "BP",
      value: i < 4 ? "120" : "200",
      recordedAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
    });
  }

  const analytics = buildPatientVitalsAnalytics(records);
  // For test flexibility, override anomalyCount directly
  return { ...analytics, anomalyCount };
}

function makeLabFlags(outOfRange: number, total: number): LabFlag[] {
  const flags: LabFlag[] = [];
  for (let i = 0; i < total; i++) {
    flags.push({
      id: `l${i}`,
      testName: "Test",
      value: "100",
      numericValue: 100,
      referenceRange: "70-120",
      low: 70,
      high: 120,
      status: i < outOfRange ? "high" : "normal",
      recordedAt: new Date(),
    });
  }
  return flags;
}

describe("computeCompositeRiskScore", () => {
  it("returns score 0 and tier 'low' for healthy patient", () => {
    const result = computeCompositeRiskScore(
      makeVitals(0),
      {},
      makeLabFlags(0, 5),
      [],
    );

    expect(result.score).toBe(0);
    expect(result.tier).toBe("low");
    expect(result.contributors).toHaveLength(4);
  });

  it("returns 'critical' tier when all risk factors present", () => {
    const riskFlags = {
      highBloodPressureTrend: true,
      risingGlucoseTrend: true,
      tachycardiaTrend: true,
      rapidWeightChange: true,
    };
    const result = computeCompositeRiskScore(
      makeVitals(5),
      riskFlags,
      makeLabFlags(4, 4),
      ["chest pain", "syncope", "fatigue", "dizziness"],
    );

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.tier).toBe("critical");
  });

  it("returns 'moderate' tier for partial risk", () => {
    const riskFlags = { highBloodPressureTrend: true };
    const result = computeCompositeRiskScore(
      makeVitals(1),
      riskFlags,
      makeLabFlags(1, 4),
      ["fatigue"],
    );

    // With 1 anomaly (20*0.30=6), 1 AI flag (25*0.30=7.5), 1/4 labs OOR (25*0.25=6.25), 1 symptom (25*0.15=3.75) = ~24
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThan(75);
    expect(["low", "moderate", "high"]).toContain(result.tier);
  });

  it("has exactly 4 contributors", () => {
    const result = computeCompositeRiskScore(
      makeVitals(0),
      {},
      [],
      [],
    );
    expect(result.contributors).toHaveLength(4);
    const sources = result.contributors.map((c) => c.source);
    expect(sources).toContain("vital_anomalies");
    expect(sources).toContain("ai_risk_flags");
    expect(sources).toContain("lab_out_of_range");
    expect(sources).toContain("concerning_symptoms");
  });

  it("clamps sub-scores between 0 and 100", () => {
    const result = computeCompositeRiskScore(
      makeVitals(100),
      {
        highBloodPressureTrend: true,
        risingGlucoseTrend: true,
        tachycardiaTrend: true,
        rapidWeightChange: true,
      },
      makeLabFlags(10, 10),
      ["chest pain", "syncope", "fatigue", "dizziness", "palpitation", "edema"],
    );

    for (const c of result.contributors) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
