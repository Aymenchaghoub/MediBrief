import { describe, expect, it } from "vitest";
import type { Consultation, LabResult, Patient, VitalRecord } from "@prisma/client";
import { buildRiskFlags, buildStructuredInput, generateClinicalSummary } from "./service";

function makePatient(): Patient {
  return {
    id: "patient-1",
    clinicId: "clinic-1",
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: new Date("1980-01-15"),
    gender: "FEMALE",
    phone: "+33100000000",
    email: null,
    passwordHash: null,
    inviteToken: null,
    inviteExpiresAt: null,
    isArchived: false,
    createdAt: new Date(),
  };
}

function makeVitals(): VitalRecord[] {
  return [
    { id: "v1", patientId: "patient-1", type: "BP", value: "118", numericValue: 118, unit: "mmHg", recordedAt: new Date("2026-01-01"), deletedAt: null },
    { id: "v2", patientId: "patient-1", type: "BP", value: "120", numericValue: 120, unit: "mmHg", recordedAt: new Date("2026-01-10"), deletedAt: null },
    { id: "v3", patientId: "patient-1", type: "BP", value: "122", numericValue: 122, unit: "mmHg", recordedAt: new Date("2026-01-20"), deletedAt: null },
    { id: "v4", patientId: "patient-1", type: "BP", value: "119", numericValue: 119, unit: "mmHg", recordedAt: new Date("2026-01-25"), deletedAt: null },
    { id: "v5", patientId: "patient-1", type: "BP", value: "121", numericValue: 121, unit: "mmHg", recordedAt: new Date("2026-01-28"), deletedAt: null },
    { id: "v6", patientId: "patient-1", type: "BP", value: "120", numericValue: 120, unit: "mmHg", recordedAt: new Date("2026-02-01"), deletedAt: null },
    { id: "v7", patientId: "patient-1", type: "BP", value: "150", numericValue: 150, unit: "mmHg", recordedAt: new Date("2026-02-10"), deletedAt: null },
    { id: "v8", patientId: "patient-1", type: "GLUCOSE", value: "92", numericValue: 92, unit: "mg/dL", recordedAt: new Date("2026-01-01"), deletedAt: null },
    { id: "v9", patientId: "patient-1", type: "GLUCOSE", value: "94", numericValue: 94, unit: "mg/dL", recordedAt: new Date("2026-01-10"), deletedAt: null },
    { id: "v10", patientId: "patient-1", type: "GLUCOSE", value: "95", numericValue: 95, unit: "mg/dL", recordedAt: new Date("2026-01-20"), deletedAt: null },
    { id: "v11", patientId: "patient-1", type: "GLUCOSE", value: "93", numericValue: 93, unit: "mg/dL", recordedAt: new Date("2026-01-25"), deletedAt: null },
    { id: "v12", patientId: "patient-1", type: "GLUCOSE", value: "94", numericValue: 94, unit: "mg/dL", recordedAt: new Date("2026-01-28"), deletedAt: null },
    { id: "v13", patientId: "patient-1", type: "GLUCOSE", value: "93", numericValue: 93, unit: "mg/dL", recordedAt: new Date("2026-02-01"), deletedAt: null },
    { id: "v14", patientId: "patient-1", type: "GLUCOSE", value: "130", numericValue: 130, unit: "mg/dL", recordedAt: new Date("2026-02-10"), deletedAt: null },
    { id: "v15", patientId: "patient-1", type: "HEART_RATE", value: "70", numericValue: 70, unit: "bpm", recordedAt: new Date("2026-01-01"), deletedAt: null },
    { id: "v16", patientId: "patient-1", type: "HEART_RATE", value: "72", numericValue: 72, unit: "bpm", recordedAt: new Date("2026-01-10"), deletedAt: null },
    { id: "v17", patientId: "patient-1", type: "HEART_RATE", value: "74", numericValue: 74, unit: "bpm", recordedAt: new Date("2026-01-20"), deletedAt: null },
    { id: "v18", patientId: "patient-1", type: "HEART_RATE", value: "71", numericValue: 71, unit: "bpm", recordedAt: new Date("2026-01-25"), deletedAt: null },
    { id: "v19", patientId: "patient-1", type: "HEART_RATE", value: "73", numericValue: 73, unit: "bpm", recordedAt: new Date("2026-01-28"), deletedAt: null },
    { id: "v20", patientId: "patient-1", type: "HEART_RATE", value: "72", numericValue: 72, unit: "bpm", recordedAt: new Date("2026-02-01"), deletedAt: null },
    { id: "v21", patientId: "patient-1", type: "HEART_RATE", value: "110", numericValue: 110, unit: "bpm", recordedAt: new Date("2026-02-10"), deletedAt: null },
    { id: "v22", patientId: "patient-1", type: "WEIGHT", value: "70", numericValue: 70, unit: "kg", recordedAt: new Date("2026-01-01"), deletedAt: null },
    { id: "v23", patientId: "patient-1", type: "WEIGHT", value: "70.5", numericValue: 70.5, unit: "kg", recordedAt: new Date("2026-01-10"), deletedAt: null },
    { id: "v24", patientId: "patient-1", type: "WEIGHT", value: "71", numericValue: 71, unit: "kg", recordedAt: new Date("2026-01-20"), deletedAt: null },
    { id: "v25", patientId: "patient-1", type: "WEIGHT", value: "70.2", numericValue: 70.2, unit: "kg", recordedAt: new Date("2026-01-25"), deletedAt: null },
    { id: "v26", patientId: "patient-1", type: "WEIGHT", value: "70.8", numericValue: 70.8, unit: "kg", recordedAt: new Date("2026-01-28"), deletedAt: null },
    { id: "v27", patientId: "patient-1", type: "WEIGHT", value: "70.5", numericValue: 70.5, unit: "kg", recordedAt: new Date("2026-02-01"), deletedAt: null },
    { id: "v28", patientId: "patient-1", type: "WEIGHT", value: "77", numericValue: 77, unit: "kg", recordedAt: new Date("2026-02-10"), deletedAt: null },
  ];
}

function makeLabs(): LabResult[] {
  return [
    {
      id: "l1",
      patientId: "patient-1",
      testName: "HbA1c",
      value: "6.8",
      numericValue: 6.8,
      unit: "%",
      referenceRange: "4.0-5.6",
      recordedAt: new Date("2026-02-05"),
      deletedAt: null,
    },
  ];
}

function makeConsultations(): Consultation[] {
  return [
    {
      id: "c1",
      patientId: "patient-1",
      doctorId: "doctor-1",
      date: new Date("2026-02-08"),
      symptoms: "fatigue and dizziness",
      notes: "Follow-up needed",
      createdAt: new Date("2026-02-08"),
      deletedAt: null,
    },
  ];
}

describe("AI service utilities", () => {
  it("builds structured input with trend arrays", () => {
    const input = buildStructuredInput(makePatient(), makeVitals(), makeLabs(), makeConsultations());

    expect(input.age).not.toBeNull();
    expect(input.bpTrend).toEqual([118, 120, 122, 119, 121, 120, 150]);
    expect(input.glucoseTrend).toEqual([92, 94, 95, 93, 94, 93, 130]);
    expect(input.heartRateTrend).toEqual([70, 72, 74, 71, 73, 72, 110]);
    expect(input.weightTrend).toEqual([70, 70.5, 71, 70.2, 70.8, 70.5, 77]);
    expect(input.recentLabValues).toHaveLength(1);
    expect(input.recentSymptoms[0]).toContain("fatigue");
  });

  it("detects risk flags from trends and symptoms", () => {
    const input = buildStructuredInput(makePatient(), makeVitals(), makeLabs(), makeConsultations());
    const flags = buildRiskFlags(input);

    expect(flags.highBloodPressureTrend).toBe(true);
    expect(flags.risingGlucoseTrend).toBe(true);
    expect(flags.tachycardiaTrend).toBe(true);
    expect(flags.rapidWeightChange).toBe(true);
    expect(flags.concerningSymptoms.length).toBeGreaterThan(0);
    expect(flags.disclaimer).toContain("not a diagnosis");
  });

  it("generates fallback summary when API key is absent", async () => {
    const input = buildStructuredInput(makePatient(), makeVitals(), makeLabs(), makeConsultations());
    const summary = await generateClinicalSummary(input);

    expect(summary.summaryText).toContain("Clinical Trend Summary");
    expect(summary.summaryText).toContain("not a diagnosis");
    expect(summary.riskFlags.risingGlucoseTrend).toBe(true);
  });
});
