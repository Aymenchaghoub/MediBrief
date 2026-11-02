"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";

interface Appointment {
  id: string;
  date: string;
  symptoms: string;
  notes: string | null;
  doctorName: string;
  createdAt: string;
}

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    portalFetch<Appointment[]>("/portal/appointments")
      .then(setAppointments)
      .catch((error) =>
        setLoadError(
          error instanceof Error ? error.message : "Unable to load this page",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="loading-state" role="status">
        Loading appointments…
      </p>
    );
  }

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.date) >= now);
  const past = appointments.filter((a) => new Date(a.date) < now);

  if (loadError) {
    return (
      <section className="panel">
        <h2 className="section-title">My appointments</h2>
        <p className="form-error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">My Appointments</h2>
        <p className="muted section-description">
          Your upcoming and past consultations (rendez-vous).
        </p>
      </div>

      {/* Upcoming */}
      <div className="panel" style={{ marginBottom: "16px" }}>
        <h3 className="section-title">
          Upcoming{" "}
          <span className="muted" style={{ fontWeight: 400 }}>
            ({upcoming.length})
          </span>
        </h3>
        {upcoming.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No upcoming appointments"
            description="When your doctor schedules a visit, it will appear here."
          />
        ) : (
          <div className="portal-appointment-list" style={{ marginTop: "8px" }}>
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="portal-appointment-card panel"
                style={{ marginBottom: "8px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "1rem" }}>
                      {formatDate(a.date)}
                    </p>
                    <p className="muted" style={{ fontSize: "0.88rem" }}>
                      Dr. {a.doctorName}
                    </p>
                  </div>
                  <span className="badge badge-safe">Upcoming</span>
                </div>
                <p style={{ marginTop: "8px", fontSize: "0.92rem" }}>
                  <strong>Symptoms:</strong> {a.symptoms}
                </p>
                {a.notes && (
                  <p
                    className="muted"
                    style={{ marginTop: "4px", fontSize: "0.88rem" }}
                  >
                    <strong>Notes:</strong> {a.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      <div className="panel">
        <h3 className="section-title">
          Past Consultations{" "}
          <span className="muted" style={{ fontWeight: 400 }}>
            ({past.length})
          </span>
        </h3>
        {past.length === 0 ? (
          <EmptyState
            icon="consultations"
            title="No past consultations"
            description="Your consultation history will build up over time."
          />
        ) : (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Past consultations"
            style={{ marginTop: "8px" }}
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Doctor</th>
                  <th>Symptoms</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.date)}</td>
                    <td>Dr. {a.doctorName}</td>
                    <td>{a.symptoms}</td>
                    <td className="muted">{a.notes ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
