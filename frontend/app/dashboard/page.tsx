"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

interface ClinicRisk {
  totalPatientsWithSummary: number;
  highRiskCount: number;
}

export default function DashboardHomePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsCount, setPatientsCount] = useState(0);
  const [riskData, setRiskData] = useState<ClinicRisk>({ totalPatientsWithSummary: 0, highRiskCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Patient[]; nextCursor: string | null }>("/patients?limit=100", { auth: true }),
      apiFetch<ClinicRisk>("/analytics/clinic-risk", { auth: true }),
    ])
      .then(([resp, clinicRisk]) => {
        setPatients(resp.data);
        setPatientsCount(resp.data.length);
        setRiskData(clinicRisk);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load dashboard data");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const recentPatients = useMemo(
    () => [...patients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [patients],
  );

  const overviewStats = useMemo(
    () => [
      { label: "Patients", value: isLoading ? "..." : String(patientsCount), trend: "Clinic records" },
      { label: "Summarized Patients", value: isLoading ? "..." : String(riskData.totalPatientsWithSummary), trend: "AI-ready" },
      { label: "High-Risk Flags", value: isLoading ? "..." : String(riskData.highRiskCount), trend: "Needs attention" },
      {
        label: "Coverage",
        value: isLoading
          ? "..."
          : patientsCount > 0
            ? `${Math.round((riskData.totalPatientsWithSummary / patientsCount) * 100)}%`
            : "0%",
        trend: "Summary adoption",
      },
    ],
    [isLoading, patientsCount, riskData.highRiskCount, riskData.totalPatientsWithSummary],
  );

  return (
    <>
      <section className="grid-4">
        {overviewStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} trend={stat.trend} />
        ))}
      </section>

      <section className="panel" aria-busy={isLoading}>
        <SectionHeader title="Recent Clinical Activity" description="Latest patient records created in this clinic." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Event</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4}>Loading recent activity...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} role="alert">{error}</td>
                </tr>
              ) : recentPatients.length === 0 ? (
                <tr>
                  <td colSpan={4}>No recent activity yet.</td>
                </tr>
              ) : (
                recentPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>{patient.firstName} {patient.lastName}</td>
                    <td>Patient Profile Created</td>
                    <td><span className="badge badge-safe">Tracked</span></td>
                    <td>{formatDate(patient.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
