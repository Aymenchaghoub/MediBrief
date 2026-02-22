import type { Consultation, LabResult, Patient, VitalRecord } from "@prisma/client";
import OpenAI from "openai";
import { env } from "../../config/env";
import { anonymizeForAi } from "./anonymizer";

export interface StructuredClinicalInput {
  age: number | null;
  bpTrend: number[];
  glucoseTrend: number[];
  heartRateTrend: number[];
  weightTrend: number[];
  recentSymptoms: string[];
  recentLabValues: Array<{ testName: string; value: string; referenceRange: string | null }>;
}

export interface AiGenerationResult {
  summaryText: string;
  riskFlags: {
    highBloodPressureTrend: boolean;
    risingGlucoseTrend: boolean;
    tachycardiaTrend: boolean;
    rapidWeightChange: boolean;
    concerningSymptoms: string[];
    disclaimer: string;
  };
}

function calculateAge(dateOfBirth: Date) {
  const now = new Date();
  const years = now.getFullYear() - dateOfBirth.getFullYear();
  const birthdayPassed =
    now.getMonth() > dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() && now.getDate() >= dateOfBirth.getDate());

  return birthdayPassed ? years : years - 1;
}

function toNumericValues(values: string[]) {
  return values
    .map((entry) => {
      const parsed = Number.parseFloat(entry);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((entry): entry is number => entry !== null);
}

function firstLastDelta(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  return values[values.length - 1] - values[0];
}

function calculateLatestZScore(values: number[]) {
  if (values.length < 4) {
    return null;
  }

  const baseline = values.slice(0, -1);
  const latest = values[values.length - 1];

  const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
  const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / baseline.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return null;
  }

  return Number(((latest - mean) / stdDev).toFixed(2));
}

export function buildStructuredInput(
  patient: Patient,
  vitals: VitalRecord[],
  labs: LabResult[],
  consultations: Consultation[],
): StructuredClinicalInput {
  const bpTrend = toNumericValues(
    vitals.filter((vital) => vital.type === "BP").map((vital) => vital.value).slice(0, 10),
  );
  const glucoseTrend = toNumericValues(
    vitals.filter((vital) => vital.type === "GLUCOSE").map((vital) => vital.value).slice(0, 10),
  );
  const heartRateTrend = toNumericValues(
    vitals.filter((vital) => vital.type === "HEART_RATE").map((vital) => vital.value).slice(0, 10),
  );
  const weightTrend = toNumericValues(
    vitals.filter((vital) => vital.type === "WEIGHT").map((vital) => vital.value).slice(0, 10),
  );

  return {
    age: calculateAge(patient.dateOfBirth),
    bpTrend,
    glucoseTrend,
    heartRateTrend,
    weightTrend,
    recentSymptoms: consultations.map((consultation) => consultation.symptoms).slice(0, 5),
    recentLabValues: labs.slice(0, 8).map((lab) => ({
      testName: lab.testName,
      value: lab.value,
      referenceRange: lab.referenceRange,
    })),
  };
}

export function buildRiskFlags(input: StructuredClinicalInput): AiGenerationResult["riskFlags"] {
  const bpZScore = calculateLatestZScore(input.bpTrend);
  const glucoseZScore = calculateLatestZScore(input.glucoseTrend);
  const heartRateZScore = calculateLatestZScore(input.heartRateTrend);
  const weightZScore = calculateLatestZScore(input.weightTrend);

  const highBloodPressureTrend = bpZScore !== null && bpZScore >= 2;
  const risingGlucoseTrend = glucoseZScore !== null && glucoseZScore >= 2;
  const tachycardiaTrend = heartRateZScore !== null && heartRateZScore >= 2;
  const rapidWeightChange = weightZScore !== null && Math.abs(weightZScore) >= 2;

  const concerningSymptoms = input.recentSymptoms.filter((symptom) =>
    /(chest pain|dyspnea|fatigue|syncope|dizziness)/i.test(symptom),
  );

  return {
    highBloodPressureTrend,
    risingGlucoseTrend,
    tachycardiaTrend,
    rapidWeightChange,
    concerningSymptoms,
    disclaimer: "AI-generated monitoring support only. This is not a diagnosis.",
  };
}

function describeTrend(values: number[], label: string): string | null {
  if (values.length === 0) return null;
  if (values.length === 1) return `${label}: single reading of ${values[0]}.`;

  const latest = values[values.length - 1];
  const first = values[0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1);
  const delta = latest - first;
  const direction = delta > 0 ? "increasing" : delta < 0 ? "decreasing" : "stable";

  return `${label}: ${values.length} readings (range ${min}–${max}, avg ${avg}). Latest: ${latest}. Trend: ${direction} (Δ ${delta > 0 ? "+" : ""}${delta.toFixed(1)}).`;
}

function createFallbackSummary(input: StructuredClinicalInput, riskFlags: AiGenerationResult["riskFlags"]) {
  const sections: string[] = [];

  // Header
  sections.push("═══ MediBrief Clinical Trend Summary ═══");
  sections.push("");
  sections.push(`Patient age: ${input.age ?? "Unknown"} | Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  sections.push("");

  // Vitals section
  const vitalLines = [
    describeTrend(input.bpTrend, "Blood Pressure"),
    describeTrend(input.glucoseTrend, "Glucose"),
    describeTrend(input.heartRateTrend, "Heart Rate"),
    describeTrend(input.weightTrend, "Weight"),
  ].filter(Boolean);

  if (vitalLines.length > 0) {
    sections.push("── Vital Signs ──");
    sections.push(...vitalLines as string[]);
  } else {
    sections.push("── Vital Signs ──");
    sections.push("No vital records available for trend analysis.");
  }
  sections.push("");

  // Lab results section
  if (input.recentLabValues.length > 0) {
    sections.push("── Laboratory Results ──");
    for (const lab of input.recentLabValues) {
      const ref = lab.referenceRange ? ` (ref: ${lab.referenceRange})` : "";
      sections.push(`• ${lab.testName}: ${lab.value}${ref}`);
    }
    sections.push("");
  }

  // Symptoms section
  if (input.recentSymptoms.length > 0) {
    sections.push("── Recent Symptoms ──");
    for (const symptom of input.recentSymptoms) {
      sections.push(`• ${symptom}`);
    }
    sections.push("");
  }

  // Risk flags section
  const alerts: string[] = [];
  if (riskFlags.highBloodPressureTrend) alerts.push("⚠ Elevated blood pressure trend — consider monitoring frequency increase.");
  if (riskFlags.risingGlucoseTrend) alerts.push("⚠ Rising glucose trend — review dietary plan and HbA1c.");
  if (riskFlags.tachycardiaTrend) alerts.push("⚠ Tachycardia trend detected — evaluate cardiac workup.");
  if (riskFlags.rapidWeightChange) alerts.push("⚠ Significant weight change — assess fluid balance and nutrition.");
  if (riskFlags.concerningSymptoms.length > 0) {
    alerts.push(`⚠ Concerning symptoms reported: ${riskFlags.concerningSymptoms.join(", ")}.`);
  }

  if (alerts.length > 0) {
    sections.push("── Clinical Alerts ──");
    sections.push(...alerts);
    sections.push("");
  } else {
    sections.push("── Clinical Alerts ──");
    sections.push("No significant risk flags detected at this time.");
    sections.push("");
  }

  // Monitoring recommendation
  sections.push("── Monitoring Recommendations ──");
  if (vitalLines.length === 0 && input.recentLabValues.length === 0) {
    sections.push("Insufficient data for trend analysis. Consider adding vital signs and lab results for a comprehensive summary.");
  } else {
    sections.push("Continue routine monitoring. AI-enhanced summary will provide deeper insights when an AI provider API key is configured.");
  }
  sections.push("");

  sections.push(`Disclaimer: ${riskFlags.disclaimer}`);

  return sections.join("\n");
}

async function generateWithOpenAi(input: StructuredClinicalInput) {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const anonymized = anonymizeForAi(input);

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    defaultHeaders: {
      ...(env.OPENAI_HTTP_REFERER ? { "HTTP-Referer": env.OPENAI_HTTP_REFERER } : {}),
      ...(env.OPENAI_APP_NAME ? { "X-Title": env.OPENAI_APP_NAME } : {}),
    },
  });

  try {
    const systemPrompt = `You are MediBrief, a clinical documentation assistant for healthcare professionals.

Your task: analyze the anonymized patient data below and produce a structured clinical summary.

Rules:
- NEVER diagnose. Only identify trends, flag anomalies, and suggest monitoring focus areas.
- Write in clear, professional medical language suitable for a physician's chart review.
- Data is anonymized — do not ask for or attempt to infer patient identity.

Output format (use these exact section headers):

## Clinical Overview
Brief 2-3 sentence overview of the patient's current clinical picture.

## Vital Sign Trends
Analyze each available vital sign series. Note direction (improving/worsening/stable), rate of change, and whether values are within normal ranges. If insufficient data, state so.

## Laboratory Findings
Review lab values against reference ranges. Flag any out-of-range results and their clinical significance.

## Symptom Analysis
Correlate reported symptoms with vital/lab trends where applicable.

## Risk Assessment
List specific clinical concerns ranked by priority. For each concern, briefly explain the supporting data.

## Recommended Monitoring
Suggest specific follow-up actions, tests, or monitoring frequency adjustments.

## Disclaimer
End with: "AI-generated monitoring support only. This is not a diagnosis. Clinical decisions should be made by qualified healthcare professionals."`;

    const userPrompt = `Anonymized patient clinical data:\n\n${JSON.stringify(anonymized, null, 2)}`;

    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return response.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function generateClinicalSummary(input: StructuredClinicalInput): Promise<AiGenerationResult> {
  const riskFlags = buildRiskFlags(input);

  const aiSummary = await generateWithOpenAi(input);
  const summaryText = aiSummary ? `${aiSummary}\n\n${riskFlags.disclaimer}` : createFallbackSummary(input, riskFlags);

  return {
    summaryText,
    riskFlags,
  };
}
