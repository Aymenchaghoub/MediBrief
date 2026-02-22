import { describe, expect, it } from "vitest";
import type { VitalRecord } from "@prisma/client";
import { buildPatientVitalsAnalytics, calculateZScoreAnomalies } from "./service";

describe("analytics service", () => {
  it("detects z-score anomalies in numeric series", () => {
    const anomalies = calculateZScoreAnomalies([100, 101, 99, 102, 180], 1.5);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((entry) => entry.value === 180)).toBe(true);
  });

  it("builds vitals analytics with trend and anomaly count", () => {
    const vitals: VitalRecord[] = [
      { id: "1", patientId: "p1", type: "BP", value: "120", recordedAt: new Date("2026-01-01") },
      { id: "2", patientId: "p1", type: "BP", value: "122", recordedAt: new Date("2026-01-02") },
      { id: "3", patientId: "p1", type: "BP", value: "165", recordedAt: new Date("2026-01-03") },
      { id: "4", patientId: "p1", type: "GLUCOSE", value: "90", recordedAt: new Date("2026-01-01") },
      { id: "5", patientId: "p1", type: "GLUCOSE", value: "110", recordedAt: new Date("2026-01-02") },
    ];

    const analytics = buildPatientVitalsAnalytics(vitals);

    expect(analytics.trends).toHaveLength(4);
    expect(analytics.trends.find((trend) => trend.metric === "BP")?.latest).toBe(165);
    expect(analytics.trends.find((trend) => trend.metric === "GLUCOSE")?.delta).toBe(20);
    expect(analytics.anomalyCount).toBeGreaterThanOrEqual(0);
  });
});
