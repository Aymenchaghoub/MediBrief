import type { AISummary, LabResult, VitalRecord } from "@prisma/client";

export interface ZScoreAnomaly {
  index: number;
  value: number;
  zScore: number;
}

export interface VitalTrend {
  metric: "BP" | "GLUCOSE" | "HEART_RATE" | "WEIGHT";
  points: number;
  latest: number | null;
  delta: number;
  anomalies: ZScoreAnomaly[];
}

/* ------------------------------------------------------------------ */
/*  Composite Risk Score types                                        */
/* ------------------------------------------------------------------ */

export interface RiskContributor {
  source: string;
  weight: number;
  score: number;
  detail: string;
}

export type RiskTier = "low" | "moderate" | "high" | "critical";

export interface CompositeRiskResult {
  score: number;
  tier: RiskTier;
  contributors: RiskContributor[];
}

/* ------------------------------------------------------------------ */
/*  Lab out-of-range flagging                                          */
/* ------------------------------------------------------------------ */

export interface LabFlag {
  id: string;
  testName: string;
  value: string;
  numericValue: number | null;
  referenceRange: string | null;
  low: number | null;
  high: number | null;
  status: "normal" | "low" | "high" | "unknown";
  recordedAt: Date;
}

/**
 * Parses common reference range formats:
 *  "70-100", "< 200", "> 40", "3.5 - 5.5"
 */
export function parseReferenceRange(range: string | null): { low: number | null; high: number | null } {
  if (!range) return { low: null, high: null };

  const bounded = range.match(/^\s*([\d.]+)\s*[-–]\s*([\d.]+)\s*$/);
  if (bounded) {
    return { low: parseFloat(bounded[1]), high: parseFloat(bounded[2]) };
  }

  const lessThan = range.match(/^[<≤]\s*([\d.]+)$/);
  if (lessThan) {
    return { low: null, high: parseFloat(lessThan[1]) };
  }

  const greaterThan = range.match(/^[>≥]\s*([\d.]+)$/);
  if (greaterThan) {
    return { low: parseFloat(greaterThan[1]), high: null };
  }

  return { low: null, high: null };
}

export function flagLabResult(lab: LabResult): LabFlag {
  const numericValue = parseFloat(lab.value);
  const isNumeric = Number.isFinite(numericValue);
  const { low, high } = parseReferenceRange(lab.referenceRange);

  let status: LabFlag["status"] = "unknown";
  if (isNumeric && (low !== null || high !== null)) {
    if (low !== null && numericValue < low) {
      status = "low";
    } else if (high !== null && numericValue > high) {
      status = "high";
    } else {
      status = "normal";
    }
  }

  return {
    id: lab.id,
    testName: lab.testName,
    value: lab.value,
    numericValue: isNumeric ? numericValue : null,
    referenceRange: lab.referenceRange,
    low,
    high,
    status,
    recordedAt: lab.recordedAt,
  };
}

export function flagAllLabResults(labs: LabResult[]): LabFlag[] {
  return labs.map(flagLabResult);
}

export function toNumericSeries(values: string[]) {
  return values
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
}

export function calculateZScoreAnomalies(values: number[], threshold = 2): ZScoreAnomaly[] {
  if (values.length < 3) {
    return [];
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return [];
  }

  return values
    .map((value, index) => {
      const zScore = (value - mean) / stdDev;
      return { index, value, zScore };
    })
    .filter((entry) => Math.abs(entry.zScore) >= threshold)
    .map((entry) => ({ ...entry, zScore: Number(entry.zScore.toFixed(2)) }));
}

function buildTrend(metric: VitalTrend["metric"], records: VitalRecord[]) {
  const series = toNumericSeries(records.map((record) => record.value));
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const delta = series.length > 1 ? Number((series[series.length - 1] - series[0]).toFixed(2)) : 0;

  return {
    metric,
    points: series.length,
    latest,
    delta,
    anomalies: calculateZScoreAnomalies(series),
  } satisfies VitalTrend;
}

export function buildPatientVitalsAnalytics(vitals: VitalRecord[]) {
  const byType = {
    BP: vitals.filter((record) => record.type === "BP").sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()),
    GLUCOSE: vitals
      .filter((record) => record.type === "GLUCOSE")
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()),
    HEART_RATE: vitals
      .filter((record) => record.type === "HEART_RATE")
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()),
    WEIGHT: vitals
      .filter((record) => record.type === "WEIGHT")
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()),
  };

  const trends = [
    buildTrend("BP", byType.BP),
    buildTrend("GLUCOSE", byType.GLUCOSE),
    buildTrend("HEART_RATE", byType.HEART_RATE),
    buildTrend("WEIGHT", byType.WEIGHT),
  ];

  const anomalyCount = trends.reduce((sum, trend) => sum + trend.anomalies.length, 0);

  return {
    trends,
    anomalyCount,
  };
}

export function extractRiskFlags(aiSummary: AISummary | null) {
  if (!aiSummary || typeof aiSummary.riskFlags !== "object" || aiSummary.riskFlags === null) {
    return {};
  }

  return aiSummary.riskFlags as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Composite Risk Score (0-100)                                      */
/* ------------------------------------------------------------------ */

const RISK_WEIGHTS = {
  vitalAnomalies: 0.30,
  aiRiskFlags: 0.30,
  labOutOfRange: 0.25,
  symptomConcern: 0.15,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Computes a weighted 0-100 composite risk score from:
 *   - z-score vital anomalies (30%)
 *   - AI-generated risk flags (30%)
 *   - lab results outside reference range (25%)
 *   - concerning symptom keywords (15%)
 *
 * Returns the score, tier classification, and per-source contributors.
 */
export function computeCompositeRiskScore(
  vitalsAnalytics: ReturnType<typeof buildPatientVitalsAnalytics>,
  riskFlags: Record<string, unknown>,
  labFlags: LabFlag[],
  recentSymptoms: string[],
): CompositeRiskResult {
  const contributors: RiskContributor[] = [];

  // --- Vital anomalies (0-100 sub-score) ---
  const totalAnomalies = vitalsAnalytics.anomalyCount;
  const vitalSubScore = clamp(totalAnomalies * 20, 0, 100);
  contributors.push({
    source: "vital_anomalies",
    weight: RISK_WEIGHTS.vitalAnomalies,
    score: vitalSubScore,
    detail: `${totalAnomalies} z-score anomalies detected`,
  });

  // --- AI risk flags (0-100 sub-score) ---
  const flagKeys = ["highBloodPressureTrend", "risingGlucoseTrend", "tachycardiaTrend", "rapidWeightChange"] as const;
  const activeFlags = flagKeys.filter((key) => riskFlags[key] === true);
  const aiSubScore = clamp(activeFlags.length * 25, 0, 100);
  contributors.push({
    source: "ai_risk_flags",
    weight: RISK_WEIGHTS.aiRiskFlags,
    score: aiSubScore,
    detail: `${activeFlags.length}/${flagKeys.length} flags active: ${activeFlags.join(", ") || "none"}`,
  });

  // --- Lab out-of-range (0-100 sub-score) ---
  const evaluatedLabs = labFlags.filter((lab) => lab.status !== "unknown");
  const outOfRange = evaluatedLabs.filter((lab) => lab.status === "low" || lab.status === "high");
  const labSubScore = evaluatedLabs.length > 0
    ? clamp(Math.round((outOfRange.length / evaluatedLabs.length) * 100), 0, 100)
    : 0;
  contributors.push({
    source: "lab_out_of_range",
    weight: RISK_WEIGHTS.labOutOfRange,
    score: labSubScore,
    detail: `${outOfRange.length}/${evaluatedLabs.length} results outside reference range`,
  });

  // --- Concerning symptoms (0-100 sub-score) ---
  const concerningPattern = /(chest pain|dyspnea|fatigue|syncope|dizziness|palpitation|edema|blurred vision)/i;
  const concerningCount = recentSymptoms.filter((s) => concerningPattern.test(s)).length;
  const symptomSubScore = clamp(concerningCount * 25, 0, 100);
  contributors.push({
    source: "concerning_symptoms",
    weight: RISK_WEIGHTS.symptomConcern,
    score: symptomSubScore,
    detail: `${concerningCount} concerning symptom(s) in recent consultations`,
  });

  // --- Weighted composite ---
  const score = Math.round(
    contributors.reduce((sum, c) => sum + c.weight * c.score, 0),
  );

  let tier: RiskTier = "low";
  if (score >= 75) tier = "critical";
  else if (score >= 50) tier = "high";
  else if (score >= 25) tier = "moderate";

  return { score, tier, contributors };
}
