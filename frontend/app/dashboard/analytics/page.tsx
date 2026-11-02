"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}
interface VitalRecord {
  id: string;
  type: string;
  value: string;
  numericValue: number | null;
  unit: string;
  recordedAt: string;
}
interface PatientAnalyticsResponse {
  vitals: {
    anomalyCount: number;
    trends: Array<{
      metric: "BP" | "GLUCOSE" | "HEART_RATE" | "WEIGHT";
      latest: number | null;
      points: number;
      anomalies: Array<{ value: number; zScore: number }>;
    }>;
  };
}
interface PatientResult {
  id: string;
  analytics: PatientAnalyticsResponse | null;
  records: VitalRecord[] | null;
  analyticsError: string | null;
  recordsError: string | null;
}
const METRICS = [
  { type: "BP", label: "Blood pressure", note: "Systolic value" },
  { type: "GLUCOSE", label: "Glucose", note: "Recorded values" },
  { type: "HEART_RATE", label: "Heart rate", note: "Recorded values" },
  { type: "WEIGHT", label: "Weight", note: "Recorded values" },
];
const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function AnalyticsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [clinicRisk, setClinicRisk] = useState<{
    highRiskCount: number;
  } | null>(null);
  const [result, setResult] = useState<PatientResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => {
    let current = true;
    Promise.allSettled([
      apiFetch<{ data: Patient[]; nextCursor: string | null }>(
        "/patients?limit=100",
        { auth: true },
      ),
      apiFetch<{ highRiskCount: number }>("/analytics/clinic-risk", {
        auth: true,
      }),
    ]).then(([patientResponse, riskResponse]) => {
      if (!current) return;
      const errors: string[] = [];
      if (patientResponse.status === "fulfilled") {
        setPatients(patientResponse.value.data);
        setSelectedPatientId(patientResponse.value.data[0]?.id ?? "");
      } else
        errors.push(message(patientResponse.reason, "Unable to load patients"));
      if (riskResponse.status === "fulfilled")
        setClinicRisk(riskResponse.value);
      else
        errors.push(message(riskResponse.reason, "Unable to load clinic risk"));
      setLoadErrors(errors);
      setIsLoading(false);
    });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    let current = true;
    // The analytics endpoint contains outliers, not a complete time series.
    // Read the existing vitals endpoint for the actual dated measurements.
    Promise.allSettled([
      apiFetch<PatientAnalyticsResponse>(
        `/analytics/patient/${selectedPatientId}`,
        { auth: true },
      ),
      apiFetch<VitalRecord[]>(`/vitals/${selectedPatientId}`, { auth: true }),
    ]).then(([analyticsResponse, recordsResponse]) => {
      if (!current) return;
      setResult({
        id: selectedPatientId,
        analytics:
          analyticsResponse.status === "fulfilled"
            ? analyticsResponse.value
            : null,
        records:
          recordsResponse.status === "fulfilled" ? recordsResponse.value : null,
        analyticsError:
          analyticsResponse.status === "rejected"
            ? message(
                analyticsResponse.reason,
                "Unable to load patient analytics",
              )
            : null,
        recordsError:
          recordsResponse.status === "rejected"
            ? message(recordsResponse.reason, "Unable to load measurements")
            : null,
      });
    });
    return () => {
      current = false;
    };
  }, [selectedPatientId]);

  const active =
    result?.id === selectedPatientId && selectedPatientId ? result : null;
  const patientLoading = Boolean(selectedPatientId) && !active;
  const analytics = active?.analytics;
  const patientName = patients.find(
    (patient) => patient.id === selectedPatientId,
  );
  const name = patientName
    ? `${patientName.firstName} ${patientName.lastName}`
    : "Selected patient";
  const stats = [
    {
      label: "Blood pressure",
      value:
        analytics?.vitals.trends.find((entry) => entry.metric === "BP")
          ?.latest ?? "—",
      trend: "Latest analysed systolic value",
    },
    {
      label: "Glucose",
      value:
        analytics?.vitals.trends.find((entry) => entry.metric === "GLUCOSE")
          ?.latest ?? "—",
      trend: "Latest analysed value",
    },
    {
      label: "Anomalies",
      value: analytics?.vitals.anomalyCount ?? "—",
      trend: "Selected patient · Z-score analysis",
    },
    {
      label: "High-risk patients",
      value: clinicRisk?.highRiskCount ?? "—",
      trend: "Across the clinic",
    },
  ];

  return (
    <>
      <div className="page-heading">
        <p className="brand-kicker">Clinical monitoring</p>
        <h2>Analytics</h2>
        <p>
          Recorded measurements and flagged changes, in the context of each
          patient
        </p>
      </div>
      {loadErrors.map((error, index) => (
        <p key={index} className="form-error" role="alert">
          {error}
        </p>
      ))}
      <section className="panel" aria-busy={isLoading}>
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="analytics-patient">Patient context</label>
          <select
            id="analytics-patient"
            value={selectedPatientId}
            onChange={(event) => setSelectedPatientId(event.target.value)}
            disabled={isLoading || patients.length === 0}
          >
            <option value="">
              {isLoading ? "Loading patients…" : "Select patient"}
            </option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName}
              </option>
            ))}
          </select>
        </div>
        {!isLoading && patients.length === 0 && loadErrors.length === 0 && (
          <p className="muted" style={{ marginTop: 16 }}>
            Add a patient to view their measurements and analytics
          </p>
        )}
      </section>
      <section className="grid-4" aria-busy={isLoading || patientLoading}>
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={
              isLoading ||
              (patientLoading && stat.label !== "High-risk patients")
                ? "…"
                : String(stat.value)
            }
            trend={stat.trend}
          />
        ))}
      </section>
      {active?.recordsError && (
        <p className="form-error" role="alert">
          Measurements unavailable: {active.recordsError}
        </p>
      )}
      <section
        className="clinical-charts"
        aria-label="Recorded vital signs"
        aria-busy={patientLoading}
      >
        {METRICS.map((metric) => {
          const records = (active?.records ?? [])
            .filter((record) => record.type === metric.type)
            .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
          const numeric = records.filter(
            (record) =>
              Number.isFinite(
                record.numericValue ?? Number.parseFloat(record.value),
              ) && Number.isFinite(Date.parse(record.recordedAt)),
          );
          const units = new Set(numeric.map((record) => record.unit));
          const unit = numeric[0]?.unit ?? "";
          return (
            <article className="panel" key={metric.type}>
              <div className="chart-header">
                <h3>{metric.label}</h3>
                <span className="chart-meta">
                  {metric.note}
                  {unit ? ` · ${unit}` : ""}
                </span>
              </div>
              {patientLoading || isLoading ? (
                <p className="chart-empty" role="status">
                  Loading measurements…
                </p>
              ) : !selectedPatientId ? (
                <p className="chart-empty">
                  Select a patient to view recorded measurements
                </p>
              ) : active?.recordsError ? (
                <p className="chart-empty">Measurements could not be loaded</p>
              ) : records.length === 0 ? (
                <p className="chart-empty">
                  No {metric.label.toLowerCase()} measurements recorded
                </p>
              ) : units.size > 1 ? (
                <p className="chart-empty">
                  Measurements use different units. Review the original readings
                  below
                </p>
              ) : numeric.length < 2 ? (
                <div className="chart-empty">
                  {numeric[0] && (
                    <span className="chart-reading">
                      {numeric[0].value} {unit}
                    </span>
                  )}
                  <p>
                    At least two numeric, dated measurements are needed to show
                    a trend
                  </p>
                </div>
              ) : (
                <Sparkline
                  points={numeric.map(
                    (record) =>
                      record.numericValue ?? Number.parseFloat(record.value),
                  )}
                  dates={numeric.map((record) => record.recordedAt)}
                  unit={unit}
                  label={`${metric.label} for ${name}`}
                />
              )}
              {records.length > 0 && (
                <details className="chart-data">
                  <summary>
                    View {records.length} recorded measurement
                    {records.length === 1 ? "" : "s"}
                  </summary>
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label={`${metric.label} measurements`}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Value</th>
                          <th>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td>{formatDate(record.recordedAt)}</td>
                            <td>{record.value}</td>
                            <td>{record.unit || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </section>
      <section className="panel" aria-busy={patientLoading}>
        <SectionHeader
          title="Anomaly focus"
          description="Flags calculated from the patient’s recorded measurements"
        />
        {active?.analyticsError ? (
          <p className="form-error" role="alert">
            Analytics unavailable: {active.analyticsError}
          </p>
        ) : (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Patient anomalies"
          >
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Z-score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patientLoading || isLoading ? (
                  <tr>
                    <td colSpan={5}>Loading analytics…</td>
                  </tr>
                ) : !analytics ? (
                  <tr>
                    <td colSpan={5}>
                      Select a patient to view their anomaly analysis
                    </td>
                  </tr>
                ) : analytics.vitals.anomalyCount === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      No anomalies detected in the available measurements
                    </td>
                  </tr>
                ) : (
                  analytics.vitals.trends.flatMap((trend) =>
                    trend.anomalies.map((anomaly, index) => (
                      <tr key={`${trend.metric}-${index}`}>
                        <td>{name}</td>
                        <td>
                          {METRICS.find(
                            (metric) => metric.type === trend.metric,
                          )?.label ?? trend.metric}
                        </td>
                        <td>{anomaly.value}</td>
                        <td>{anomaly.zScore ?? "—"}</td>
                        <td>
                          <span className="badge badge-high">Review</span>
                        </td>
                      </tr>
                    )),
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
