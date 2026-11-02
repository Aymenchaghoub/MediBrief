"use client";

import { handleTabKeyDown } from "@/components/ui/tab-keyboard";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { generateHealthReportPdf } from "@/lib/pdf-report";
import { useToast } from "@/components/ui/toast-provider";
import { EmptyState } from "@/components/ui/empty-state";

const METRIC_LABELS: Record<string, string> = {
  BP: "Blood pressure",
  GLUCOSE: "Blood glucose",
  HEART_RATE: "Heart rate",
  WEIGHT: "Weight",
};

interface VitalRecord {
  id: string;
  type: string;
  value: string;
  numericValue: number | null;
  unit: string;
  recordedAt: string;
}

interface LabResult {
  id: string;
  testName: string;
  value: string;
  numericValue: number | null;
  unit: string;
  referenceRange: string | null;
  recordedAt: string;
  flag: string;
}

interface VitalTrend {
  metric: string;
  points: number;
  latest: number | null;
  delta: number;
  anomalies: { index: number; value: number; zScore: number }[];
}

interface VitalsAnalytics {
  trends: VitalTrend[];
  anomalyCount: number;
}

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  clinic: { name: string };
}

interface AISummary {
  id: string;
  summaryText: string;
  createdAt: string;
}

export default function MyRecordsPage() {
  const { pushToast } = useToast();
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [analytics, setAnalytics] = useState<VitalsAnalytics | null>(null);
  const [tab, setTab] = useState<"vitals" | "labs">("vitals");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      portalFetch<VitalRecord[]>("/portal/vitals"),
      portalFetch<LabResult[]>("/portal/labs"),
      portalFetch<VitalsAnalytics>("/portal/vitals/analytics"),
    ])
      .then(([v, l, a]) => {
        setVitals(v);
        setLabs(l);
        setAnalytics(a);
      })
      .catch((error) =>
        setLoadError(
          error instanceof Error ? error.message : "Unable to load this page",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const [profile, summaries] = await Promise.all([
        portalFetch<Profile>("/portal/me"),
        portalFetch<AISummary[]>("/portal/summaries"),
      ]);
      const fileName = await generateHealthReportPdf({
        profile,
        vitals,
        labs,
        latestSummary: summaries.length > 0 ? summaries[0].summaryText : null,
      });
      pushToast(`Report saved as ${fileName}`, "success");
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Failed to generate PDF",
        "error",
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <p className="loading-state" role="status">
        Loading records…
      </p>
    );
  }

  if (loadError) {
    return (
      <section className="panel">
        <h2 className="section-title">My health records</h2>
        <p className="form-error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  return (
    <>
      <div
        className="section-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 className="section-title">My Health Records</h2>
          <p className="muted section-description">
            Your vitals, lab results, and health trends.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={exporting}
          onClick={handleExportPdf}
        >
          {exporting ? "Generating…" : "Download health report"}
        </button>
      </div>

      {/* Trend cards */}
      {analytics && (
        <div className="grid-4" style={{ marginBottom: "16px" }}>
          {analytics.trends.map((t) => (
            <div
              key={METRIC_LABELS[t.metric] ?? t.metric}
              className="panel stat-card"
            >
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                {METRIC_LABELS[t.metric] ?? t.metric}
              </p>
              <p className="metric-value">{t.latest ?? "–"}</p>
              <p className="kpi-trend">
                {t.points > 1
                  ? `${t.delta > 0 ? "+" : ""}${t.delta} · ${t.points} readings`
                  : `${t.points} recorded readings · No comparison yet`}
              </p>
              {t.anomalies.length > 0 && (
                <span className="badge badge-high" style={{ marginTop: "4px" }}>
                  {t.anomalies.length} anomal
                  {t.anomalies.length === 1 ? "y" : "ies"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div
        className="tab-bar"
        role="tablist"
        aria-label="Health records"
        onKeyDown={handleTabKeyDown}
      >
        <button
          type="button"
          role="tab"
          className="tab-btn"
          aria-selected={tab === "vitals"}
          tabIndex={tab === "vitals" ? 0 : -1}
          onClick={() => setTab("vitals")}
        >
          Vitals ({vitals.length})
        </button>
        <button
          type="button"
          role="tab"
          className="tab-btn"
          aria-selected={tab === "labs"}
          tabIndex={tab === "labs" ? 0 : -1}
          onClick={() => setTab("labs")}
        >
          Lab Results ({labs.length})
        </button>
      </div>

      {/* Vitals table */}
      {tab === "vitals" && (
        <div className="panel">
          {vitals.length === 0 ? (
            <EmptyState
              icon="activity"
              title="No vitals recorded"
              description="Your clinic hasn't added any vital sign readings yet."
            />
          ) : (
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Health records"
            >
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v) => (
                    <tr key={v.id}>
                      <td>{formatDate(v.recordedAt)}</td>
                      <td>
                        <span className="badge">
                          {METRIC_LABELS[v.type] ?? v.type}
                        </span>
                      </td>
                      <td>{v.value}</td>
                      <td className="muted">{v.unit || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Labs table */}
      {tab === "labs" && (
        <div className="panel">
          {labs.length === 0 ? (
            <EmptyState
              icon="labs"
              title="No lab results yet"
              description="Lab results from your clinic will show up here automatically."
            />
          ) : (
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Health records"
            >
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Test</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Reference</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {labs.map((l) => (
                    <tr key={l.id}>
                      <td>{formatDate(l.recordedAt)}</td>
                      <td>{l.testName}</td>
                      <td>{l.value}</td>
                      <td className="muted">{l.unit || "–"}</td>
                      <td className="muted">{l.referenceRange ?? "–"}</td>
                      <td>
                        <span
                          className={`badge ${
                            l.flag === "NORMAL"
                              ? "badge-safe"
                              : l.flag === "HIGH" || l.flag === "LOW"
                                ? "badge-high"
                                : "badge-moderate"
                          }`}
                        >
                          {l.flag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
