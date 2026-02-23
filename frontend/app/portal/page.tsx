"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { generateHealthReportPdf } from "@/lib/pdf-report";
import { useToast } from "@/components/ui/toast-provider";
import { EmptyState } from "@/components/ui/empty-state";

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

interface Appointment {
  id: string;
  date: string;
  symptoms: string;
  notes: string | null;
  doctorName: string;
}

interface AISummary {
  id: string;
  summaryText: string;
  createdAt: string;
}

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

export default function PortalOverview() {
  const { pushToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      portalFetch<Profile>("/portal/me"),
      portalFetch<Appointment[]>("/portal/appointments"),
      portalFetch<AISummary[]>("/portal/summaries"),
    ])
      .then(([p, a, s]) => {
        setProfile(p);
        setAppointments(a);
        setSummaries(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="muted" style={{ padding: "2rem" }}>Loading your portal…</p>;
  }

  const upcoming = appointments.filter((a) => new Date(a.date) >= new Date());

  async function handleExportPdf() {
    if (!profile) return;
    setExporting(true);
    try {
      const [vitals, labs] = await Promise.all([
        portalFetch<VitalRecord[]>("/portal/vitals"),
        portalFetch<LabResult[]>("/portal/labs"),
      ]);
      const fileName = await generateHealthReportPdf({
        profile,
        vitals,
        labs,
        latestSummary: summaries.length > 0 ? summaries[0].summaryText : null,
      });
      pushToast(`Report saved as ${fileName}`, "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to generate PDF", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Welcome banner */}
      <div className="panel" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.8rem" }}>
        <div>
          <p className="brand-kicker">Welcome back</p>
          <h2 style={{ fontSize: "1.4rem", marginBottom: "0.4rem" }}>
            {profile?.firstName} {profile?.lastName}
          </h2>
          <p className="muted">
            {profile?.clinic.name} · Member since {profile ? formatDate(profile.createdAt) : "–"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={exporting}
          onClick={handleExportPdf}
        >
          {exporting ? "Generating…" : "⬇ Download Health Report"}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid-4" style={{ marginBottom: "1rem" }}>
        <div className="panel stat-card">
          <p className="muted" style={{ fontSize: "0.82rem" }}>Upcoming RDV</p>
          <p className="metric-value">{upcoming.length}</p>
        </div>
        <div className="panel stat-card">
          <p className="muted" style={{ fontSize: "0.82rem" }}>Past Appointments</p>
          <p className="metric-value">{appointments.length - upcoming.length}</p>
        </div>
        <div className="panel stat-card">
          <p className="muted" style={{ fontSize: "0.82rem" }}>AI Summaries</p>
          <p className="metric-value">{summaries.length}</p>
        </div>
        <div className="panel stat-card">
          <p className="muted" style={{ fontSize: "0.82rem" }}>Gender</p>
          <p className="metric-value" style={{ fontSize: "1.1rem" }}>
            {profile?.gender ?? "–"}
          </p>
        </div>
      </div>

      {/* Personal info */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="section-title">Personal Information</h3>
        <div className="detail-grid" style={{ marginTop: "0.6rem" }}>
          <div className="detail-kv">
            <span className="detail-label">Date of Birth</span>
            <span className="detail-value">{profile ? formatDate(profile.dateOfBirth) : "–"}</span>
          </div>
          <div className="detail-kv">
            <span className="detail-label">Phone</span>
            <span className="detail-value">{profile?.phone ?? "Not provided"}</span>
          </div>
          <div className="detail-kv">
            <span className="detail-label">Email</span>
            <span className="detail-value">{profile?.email ?? "Not set"}</span>
          </div>
          <div className="detail-kv">
            <span className="detail-label">Patient ID</span>
            <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
              {profile?.id.slice(0, 8)}…
            </span>
          </div>
        </div>
      </div>

      {/* Upcoming appointments */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="section-title">Upcoming Appointments</h3>
        {upcoming.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No upcoming appointments"
            description="When your clinic schedules a visit, it will appear here."
            actionLabel="View all appointments"
            actionHref="/portal/appointments"
          />
        ) : (
          <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Doctor</th>
                  <th>Symptoms</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.slice(0, 5).map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.date)}</td>
                    <td>{a.doctorName}</td>
                    <td>{a.symptoms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Latest AI summary */}
      <div className="panel">
        <h3 className="section-title">Latest AI Summary</h3>
        {summaries.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>No AI summaries yet.</p>
        ) : (
          <div style={{ marginTop: "0.5rem" }}>
            <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.3rem" }}>
              Generated {formatDate(summaries[0].createdAt)}
            </p>
            <pre className="portal-summary-text">{summaries[0].summaryText}</pre>
          </div>
        )}
      </div>
    </>
  );
}
