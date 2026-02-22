import type { Consultation, LabResult, Patient, VitalRecord } from "@prisma/client";
import OpenAI from "openai";
import { env } from "../../config/env";

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
  const highBloodPressureTrend = input.bpTrend.some((value) => value >= 140);
  const risingGlucoseTrend = firstLastDelta(input.glucoseTrend) >= 15 || input.glucoseTrend.some((value) => value >= 126);
  const tachycardiaTrend = input.heartRateTrend.some((value) => value > 100);
  const rapidWeightChange = Math.abs(firstLastDelta(input.weightTrend)) >= 4;

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

function createFallbackSummary(input: StructuredClinicalInput, riskFlags: AiGenerationResult["riskFlags"]) {
  const lines = [
    "Clinical trend summary generated from structured records.",
    `Patient age: ${input.age ?? "N/A"}`,
    `Blood pressure points: ${input.bpTrend.length}`,
    `Glucose points: ${input.glucoseTrend.length}`,
    `Heart rate points: ${input.heartRateTrend.length}`,
    `Weight points: ${input.weightTrend.length}`,
    `Recent symptom count: ${input.recentSymptoms.length}`,
  ];

  if (riskFlags.highBloodPressureTrend) {
    lines.push("Potential concern: elevated blood pressure trend observed.");
  }

  if (riskFlags.risingGlucoseTrend) {
    lines.push("Potential concern: glucose trend suggests upward evolution.");
  }

  if (riskFlags.tachycardiaTrend) {
    lines.push("Potential concern: heart rate entries include tachycardic values.");
  }

  if (riskFlags.rapidWeightChange) {
    lines.push("Potential concern: notable weight change across recent records.");
  }

  if (riskFlags.concerningSymptoms.length > 0) {
    lines.push(`Monitoring focus symptoms: ${riskFlags.concerningSymptoms.join(", ")}.`);
  }

  lines.push(riskFlags.disclaimer);

  return lines.join("\n");
}

async function generateWithOpenAi(input: StructuredClinicalInput) {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    defaultHeaders: {
      ...(env.OPENAI_HTTP_REFERER ? { "HTTP-Referer": env.OPENAI_HTTP_REFERER } : {}),
      ...(env.OPENAI_APP_NAME ? { "X-Title": env.OPENAI_APP_NAME } : {}),
    },
  });

  try {
    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a clinical documentation assistant. Never diagnose. Summarize trends, highlight anomalies, suggest monitoring focus, and include a disclaimer that this is not a diagnosis.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
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
