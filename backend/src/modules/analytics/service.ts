import type { AISummary, VitalRecord } from "@prisma/client";

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
