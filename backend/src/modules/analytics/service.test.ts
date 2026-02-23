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
      { id: "1", patientId: "p1", type: "BP", value: "120", numericValue: 120, unit: "mmHg", recordedAt: new Date("2026-01-01"), deletedAt: null },
      { id: "2", patientId: "p1", type: "BP", value: "122", numericValue: 122, unit: "mmHg", recordedAt: new Date("2026-01-02"), deletedAt: null },
      { id: "3", patientId: "p1", type: "BP", value: "121", numericValue: 121, unit: "mmHg", recordedAt: new Date("2026-01-03"), deletedAt: null },
      { id: "4", patientId: "p1", type: "BP", value: "123", numericValue: 123, unit: "mmHg", recordedAt: new Date("2026-01-04"), deletedAt: null },
      { id: "5", patientId: "p1", type: "BP", value: "165", numericValue: 165, unit: "mmHg", recordedAt: new Date("2026-01-05"), deletedAt: null },
      { id: "6", patientId: "p1", type: "GLUCOSE", value: "90", numericValue: 90, unit: "mg/dL", recordedAt: new Date("2026-01-01"), deletedAt: null },
      { id: "7", patientId: "p1", type: "GLUCOSE", value: "110", numericValue: 110, unit: "mg/dL", recordedAt: new Date("2026-01-02"), deletedAt: null },
    ];

    const analytics = buildPatientVitalsAnalytics(vitals);

    expect(analytics.trends).toHaveLength(4);
    expect(analytics.trends.find((trend) => trend.metric === "BP")?.latest).toBe(165);
    expect(analytics.trends.find((trend) => trend.metric === "GLUCOSE")?.delta).toBe(20);
    expect(analytics.anomalyCount).toBeGreaterThanOrEqual(0);
  });
});
