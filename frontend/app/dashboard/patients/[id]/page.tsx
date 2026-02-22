"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string | null;
}

interface ZScoreAnomaly {
  index: number;
  value: number;
  zScore: number;
}

interface VitalTrend {
  metric: string;
  points: number;
  latest: number | null;
  delta: number;
  anomalies: ZScoreAnomaly[];
}

interface LabFlag {
  id: string;
  testName: string;
  value: string;
  numericValue: number | null;
  referenceRange: string | null;
  status: "normal" | "low" | "high" | "unknown";
  recordedAt: string;
}

interface RiskContributor {
  source: string;
  weight: number;
  score: number;
  detail: string;
}

interface RiskScore {
  score: number;
  tier: "low" | "moderate" | "high" | "critical";
  contributors: RiskContributor[];
}

interface AnalyticsResponse {
  patient: { id: string; firstName: string; lastName: string };
  vitals: { trends: VitalTrend[]; anomalyCount: number };
  riskFlags: Record<string, unknown>;
  labFlags: LabFlag[];
  riskScore: RiskScore;
}

interface Consultation {
  id: string;
  date: string;
  symptoms: string;
  notes: string;
  doctor?: { name: string };
}

interface AISummary {
  id: string;
  summaryText: string;
  createdAt: string;
}

const TABS = ["Overview", "Vitals", "Labs", "Consultations", "AI Summary", "Chat"] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [patientData, analyticsData, consultResp] = await Promise.all([
        apiFetch<Patient>(`/patients/${patientId}`, { auth: true }),
        apiFetch<AnalyticsResponse>(`/analytics/patient/${patientId}`, { auth: true }),
        apiFetch<{ data: Consultation[]; nextCursor: string | null }>(`/consultations/${patientId}?limit=100`, { auth: true }),
      ]);

      setPatient(patientData);
      setAnalytics(analyticsData);
      setConsultations(consultResp.data);

      // Load AI summaries — endpoint may not exist yet, gracefully handle
      try {
        const aiData = await apiFetch<AISummary[]>(`/ai/summaries/patient/${patientId}`, { auth: true });
        setSummaries(aiData);
      } catch {
        setSummaries([]);
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to load patient.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [patientId, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <section className="panel">
        <p className="muted">Loading patient details...</p>
      </section>
    );
  }

  if (!patient || !analytics) {
    return (
      <section className="panel">
        <p className="muted">Patient not found.</p>
        <Link href="/dashboard/patients" className="btn btn-secondary" style={{ marginTop: "0.6rem", display: "inline-block" }}>
          Back to patients
        </Link>
      </section>
    );
  }

  const { riskScore } = analytics;

  return (
    <>
      {/* Header */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
          <div>
            <h2 style={{ margin: 0 }}>
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {patient.gender} &middot; DOB {formatDate(patient.dateOfBirth)}
              {patient.phone ? ` · ${patient.phone}` : ""}
            </p>
          </div>
          <RiskBadge score={riskScore.score} tier={riskScore.tier} />
        </div>
      </section>

      {/* Tab Bar */}
      <div className="tab-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            className="tab-btn"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && <OverviewTab analytics={analytics} />}
      {activeTab === "Vitals" && <VitalsTab trends={analytics.vitals.trends} />}
      {activeTab === "Labs" && <LabsTab labs={analytics.labFlags} />}
      {activeTab === "Consultations" && <ConsultationsTab consultations={consultations} />}
      {activeTab === "AI Summary" && <AISummaryTab summaries={summaries} />}
      {activeTab === "Chat" && <ChatTab patientId={patientId} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function RiskBadge({ score, tier }: { score: number; tier: RiskScore["tier"] }) {
  const colorMap: Record<string, string> = {
    low: "rgba(5, 150, 105, 0.7)",
    moderate: "rgba(234, 179, 8, 0.7)",
    high: "rgba(249, 115, 22, 0.7)",
    critical: "rgba(239, 68, 68, 0.7)",
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div className="risk-gauge" style={{ minWidth: 180 }}>
        <div className="risk-gauge-bar">
          <div
            className="risk-gauge-fill"
            style={{ width: `${score}%`, background: colorMap[tier] }}
          />
        </div>
        <span className="risk-gauge-label" style={{ color: colorMap[tier] }}>
          {score}
        </span>
      </div>
      <span className={`badge badge-${tier}`} style={{ textTransform: "uppercase", fontSize: "0.78rem" }}>
        {tier} risk
      </span>
    </div>
  );
}

function OverviewTab({ analytics }: { analytics: AnalyticsResponse }) {
  const { riskScore, vitals, labFlags } = analytics;
  const outOfRange = labFlags.filter((l) => l.status === "low" || l.status === "high");

  return (
    <section className="panel">
      <SectionHeader title="Risk Overview" description="Composite score breakdown from vitals, labs, AI flags, and symptoms." />

      <div className="detail-grid" style={{ marginBottom: "1.2rem" }}>
        <div className="detail-kv">
          <span className="detail-label">Composite Score</span>
          <span className="detail-value">{riskScore.score} / 100</span>
        </div>
        <div className="detail-kv">
          <span className="detail-label">Tier</span>
          <span className={`badge badge-${riskScore.tier}`} style={{ textTransform: "uppercase" }}>{riskScore.tier}</span>
        </div>
        <div className="detail-kv">
          <span className="detail-label">Vital anomalies</span>
          <span className="detail-value">{vitals.anomalyCount}</span>
        </div>
        <div className="detail-kv">
          <span className="detail-label">Labs out of range</span>
          <span className="detail-value">{outOfRange.length}</span>
        </div>
      </div>

      <h3 style={{ fontSize: "0.95rem", marginBottom: "0.6rem" }}>Score Contributors</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Weight</th>
              <th>Sub-score</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {riskScore.contributors.map((c) => (
              <tr key={c.source}>
                <td>{c.source.replace(/_/g, " ")}</td>
                <td>{Math.round(c.weight * 100)}%</td>
                <td>{c.score}</td>
                <td className="muted">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VitalsTab({ trends }: { trends: VitalTrend[] }) {
  return (
    <section className="panel">
      <SectionHeader title="Vital Trends" description="Z-score anomaly detection across 4 vital categories." />

      {trends.map((trend) => (
        <div key={trend.metric} className="panel timeline-item" style={{ marginBottom: "0.8rem" }}>
          <h4 style={{ margin: 0 }}>
            {trend.metric.replace(/_/g, " ")}
            <span className="muted" style={{ fontWeight: 400, marginLeft: "0.5rem" }}>
              {trend.points} data points
            </span>
          </h4>
          <p style={{ margin: "0.3rem 0" }}>
            Latest: <strong>{trend.latest ?? "—"}</strong> &middot; Delta: <strong>{trend.delta > 0 ? "+" : ""}{trend.delta}</strong>
          </p>
          {trend.anomalies.length > 0 ? (
            <p style={{ color: "#f87171", fontSize: "0.88rem" }}>
              {trend.anomalies.length} anomal{trend.anomalies.length === 1 ? "y" : "ies"} (z-score ≥ 2):
              {" "}
              {trend.anomalies.map((a) => `${a.value} (z=${a.zScore})`).join(", ")}
            </p>
          ) : (
            <p className="muted" style={{ fontSize: "0.88rem" }}>No anomalies detected.</p>
          )}
        </div>
      ))}
    </section>
  );
}

function LabsTab({ labs }: { labs: LabFlag[] }) {
  if (labs.length === 0) {
    return (
      <section className="panel">
        <SectionHeader title="Lab Results" description="Out-of-range detection with reference range parsing." />
        <p className="muted">No lab results recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <SectionHeader title="Lab Results" description="Flagged against parsed reference ranges." />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Value</th>
              <th>Range</th>
              <th>Status</th>
              <th>Recorded</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((lab) => (
              <tr key={lab.id}>
                <td>{lab.testName}</td>
                <td><strong>{lab.value}</strong></td>
                <td className="muted">{lab.referenceRange ?? "—"}</td>
                <td>
                  <LabStatusBadge status={lab.status} />
                </td>
                <td>{formatDate(lab.recordedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LabStatusBadge({ status }: { status: LabFlag["status"] }) {
  const map: Record<string, { cls: string; label: string }> = {
    normal: { cls: "badge-safe", label: "Normal" },
    low: { cls: "badge-high", label: "Low" },
    high: { cls: "badge-high", label: "High" },
    unknown: { cls: "", label: "N/A" },
  };

  const { cls, label } = map[status] ?? map.unknown;
  return <span className={`badge ${cls}`}>{label}</span>;
}

function ConsultationsTab({ consultations }: { consultations: Consultation[] }) {
  if (consultations.length === 0) {
    return (
      <section className="panel">
        <SectionHeader title="Consultations" description="Clinical visit history." />
        <p className="muted">No consultations recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <SectionHeader title="Consultations" description="Recent clinical visits with symptoms and notes." />

      {consultations.map((c) => (
        <div key={c.id} className="panel timeline-item" style={{ marginBottom: "0.7rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong>{formatDate(c.date)}</strong>
            {c.doctor ? <span className="muted">{c.doctor.name}</span> : null}
          </div>
          <p style={{ margin: "0.3rem 0 0.15rem" }}><strong>Symptoms:</strong> {c.symptoms}</p>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>{c.notes}</p>
        </div>
      ))}
    </section>
  );
}

function AISummaryTab({ summaries }: { summaries: AISummary[] }) {
  if (summaries.length === 0) {
    return (
      <section className="panel">
        <SectionHeader title="AI Summaries" description="Historical AI-generated clinical summaries." />
        <p className="muted">
          No AI summaries generated yet.{" "}
          <Link href="/dashboard/ai-summary">Generate one now →</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <SectionHeader title="AI Summaries" description="Historical AI-generated clinical summaries." />

      {summaries.map((s) => (
        <div key={s.id} className="panel timeline-item" style={{ marginBottom: "0.7rem" }}>
          <p className="muted" style={{ margin: "0 0 0.3rem", fontSize: "0.82rem" }}>
            Generated {formatDate(s.createdAt)}
          </p>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{s.summaryText}</p>
        </div>
      ))}
    </section>
  );
}

/* ─── Chat Tab ─── */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ChatTab({ patientId }: { patientId: string }) {
  const { pushToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const resp = await apiFetch<{ answer: string }>(`/ai/chat/${patientId}`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ message: trimmed }),
      });

      setMessages((prev) => [...prev, { role: "assistant", content: resp.answer }]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Chat request failed.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errMsg}` }]);
      pushToast(errMsg, "error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="panel">
      <SectionHeader
        title="Chat with Records"
        description="Ask clinical questions grounded in this patient's anonymized data."
      />

      <div
        style={{
          maxHeight: "400px",
          overflowY: "auto",
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        {messages.length === 0 && (
          <p className="muted">
            Ask a question about this patient&apos;s vitals, labs, or consultation history.
          </p>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              padding: "0.6rem 0.8rem",
              borderRadius: "0.5rem",
              background: msg.role === "user" ? "var(--clr-surface-2)" : "var(--clr-surface-1)",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.2rem" }}>
              {msg.role === "user" ? "You" : "AI Assistant"}
            </p>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
          </div>
        ))}
        {isSending && (
          <p className="muted" style={{ alignSelf: "flex-start" }}>
            AI is thinking...
          </p>
        )}
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about vitals, trends, labs, symptoms..."
          disabled={isSending}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={isSending || !input.trim()}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
