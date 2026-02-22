"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface PatientAnalyticsResponse {
  vitals: {
    anomalyCount: number;
    trends: Array<{
      metric: "BP" | "GLUCOSE" | "HEART_RATE" | "WEIGHT";
      latest: number | null;
      points: number;
      anomalies: Array<{ value: number }>;
    }>;
  };
}

interface ClinicRiskResponse {
  highRiskCount: number;
}

export default function AnalyticsPage() {
  const { pushToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [clinicRisk, setClinicRisk] = useState<ClinicRiskResponse>({ highRiskCount: 0 });
  const [patientAnalytics, setPatientAnalytics] = useState<PatientAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Patient[]; nextCursor: string | null }>("/patients?limit=100", { auth: true }),
      apiFetch<ClinicRiskResponse>("/analytics/clinic-risk", { auth: true }),
    ])
      .then(([resp, clinicRiskData]) => {
        setPatients(resp.data);
        setClinicRisk(clinicRiskData);
        if (resp.data[0]) {
          setSelectedPatientId(resp.data[0].id);
        }
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "Unable to load analytics.", "error");
      })
      .finally(() => setIsLoading(false));
  }, [pushToast]);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    apiFetch<PatientAnalyticsResponse>(`/analytics/patient/${selectedPatientId}`, { auth: true })
      .then(setPatientAnalytics)
      .catch((error) => {
        setPatientAnalytics(null);
        pushToast(error instanceof Error ? error.message : "Unable to load patient analytics.", "error");
      });
  }, [pushToast, selectedPatientId]);

  const bpSeries =
    patientAnalytics?.vitals.trends.find((trend) => trend.metric === "BP")?.anomalies.map((entry) => entry.value) ??
    [118, 121, 124, 138, 134, 141, 145];

  const glucoseSeries =
    patientAnalytics?.vitals.trends
      .find((trend) => trend.metric === "GLUCOSE")
      ?.anomalies.map((entry) => entry.value) ?? [88, 90, 94, 99, 104, 112, 118];

  const analyticsStats = useMemo(
    () => [
      {
        label: "BP Trend",
        value: String(patientAnalytics?.vitals.trends.find((entry) => entry.metric === "BP")?.latest ?? "--"),
        trend: "Latest value",
      },
      {
        label: "Glucose Trend",
        value: String(patientAnalytics?.vitals.trends.find((entry) => entry.metric === "GLUCOSE")?.latest ?? "--"),
        trend: "Latest value",
      },
      {
        label: "Anomalies (Z-score)",
        value: String(patientAnalytics?.vitals.anomalyCount ?? 0),
        trend: "Current patient",
      },
      {
        label: "High-Risk Patients",
        value: String(clinicRisk.highRiskCount),
        trend: "Clinic-wide",
      },
    ],
    [clinicRisk.highRiskCount, patientAnalytics],
  );

  return (
    <>
      <section className="panel" aria-busy={isLoading}>
        <div className="field">
          <label htmlFor="analytics-patient">Patient context</label>
          <select
            id="analytics-patient"
            value={selectedPatientId}
            onChange={(event) => setSelectedPatientId(event.target.value)}
            disabled={patients.length === 0}
          >
            <option value="">Select patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!isLoading && patients.length === 0 ? (
        <section className="panel">
          <p className="muted">Add at least one patient to unlock analytics insights.</p>
        </section>
      ) : null}

      <section className="grid-4">
        {analyticsStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} trend={stat.trend} />
        ))}
      </section>

      <section className="grid-4">
        <article className="panel">
          <p className="muted">Blood Pressure</p>
          <Sparkline points={bpSeries.length > 0 ? bpSeries : [118, 121, 124, 138, 134, 141, 145]} />
        </article>
        <article className="panel">
          <p className="muted">Glucose</p>
          <Sparkline points={glucoseSeries.length > 0 ? glucoseSeries : [88, 90, 94, 99, 104, 112, 118]} />
        </article>
        <article className="panel">
          <p className="muted">Heart Rate</p>
          <Sparkline points={[72, 73, 75, 79, 84, 90, 86]} />
        </article>
        <article className="panel">
          <p className="muted">Weight</p>
          <Sparkline points={[70, 70.4, 70.8, 71, 71.6, 72.2, 72.5]} />
        </article>
      </section>

      <section className="panel" aria-busy={isLoading}>
        <SectionHeader title="Anomaly Focus" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Metric</th>
                <th>Z-Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {patientAnalytics?.vitals.trends.flatMap((trend) =>
                trend.anomalies.map((anomaly, index) => (
                  <tr key={`${trend.metric}-${index}`}>
                    <td>Selected Patient</td>
                    <td>{trend.metric}</td>
                    <td>{anomaly.value}</td>
                    <td><span className="badge badge-high">Review</span></td>
                  </tr>
                )),
              )}
              {!isLoading && (!patientAnalytics || patientAnalytics.vitals.anomalyCount === 0) ? (
                <tr>
                  <td colSpan={4}>No anomalies detected for the selected patient.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
