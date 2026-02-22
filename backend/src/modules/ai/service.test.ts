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
    isArchived: false,
    createdAt: new Date(),
  };
}

function makeVitals(): VitalRecord[] {
  return [
    { id: "v1", patientId: "patient-1", type: "BP", value: "118", recordedAt: new Date("2026-01-01") },
    { id: "v2", patientId: "patient-1", type: "BP", value: "120", recordedAt: new Date("2026-01-10") },
    { id: "v3", patientId: "patient-1", type: "BP", value: "122", recordedAt: new Date("2026-01-20") },
    { id: "v4", patientId: "patient-1", type: "BP", value: "150", recordedAt: new Date("2026-02-10") },
    { id: "v5", patientId: "patient-1", type: "GLUCOSE", value: "92", recordedAt: new Date("2026-01-01") },
    { id: "v6", patientId: "patient-1", type: "GLUCOSE", value: "94", recordedAt: new Date("2026-01-10") },
    { id: "v7", patientId: "patient-1", type: "GLUCOSE", value: "95", recordedAt: new Date("2026-01-20") },
    { id: "v8", patientId: "patient-1", type: "GLUCOSE", value: "130", recordedAt: new Date("2026-02-10") },
    { id: "v9", patientId: "patient-1", type: "HEART_RATE", value: "70", recordedAt: new Date("2026-01-01") },
    { id: "v10", patientId: "patient-1", type: "HEART_RATE", value: "72", recordedAt: new Date("2026-01-10") },
    { id: "v11", patientId: "patient-1", type: "HEART_RATE", value: "74", recordedAt: new Date("2026-01-20") },
    { id: "v12", patientId: "patient-1", type: "HEART_RATE", value: "110", recordedAt: new Date("2026-02-10") },
    { id: "v13", patientId: "patient-1", type: "WEIGHT", value: "70", recordedAt: new Date("2026-01-01") },
    { id: "v14", patientId: "patient-1", type: "WEIGHT", value: "70.5", recordedAt: new Date("2026-01-10") },
    { id: "v15", patientId: "patient-1", type: "WEIGHT", value: "71", recordedAt: new Date("2026-01-20") },
    { id: "v16", patientId: "patient-1", type: "WEIGHT", value: "77", recordedAt: new Date("2026-02-10") },
  ];
}

function makeLabs(): LabResult[] {
  return [
    {
      id: "l1",
      patientId: "patient-1",
      testName: "HbA1c",
      value: "6.8",
      referenceRange: "4.0-5.6",
      recordedAt: new Date("2026-02-05"),
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
    },
  ];
}

describe("AI service utilities", () => {
  it("builds structured input with trend arrays", () => {
    const input = buildStructuredInput(makePatient(), makeVitals(), makeLabs(), makeConsultations());

    expect(input.age).not.toBeNull();
    expect(input.bpTrend).toEqual([118, 120, 122, 150]);
    expect(input.glucoseTrend).toEqual([92, 94, 95, 130]);
    expect(input.heartRateTrend).toEqual([70, 72, 74, 110]);
    expect(input.weightTrend).toEqual([70, 70.5, 71, 77]);
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

    expect(summary.summaryText).toContain("Clinical trend summary");
    expect(summary.summaryText).toContain("not a diagnosis");
    expect(summary.riskFlags.risingGlucoseTrend).toBe(true);
  });
});
