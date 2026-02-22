"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface Consultation {
  id: string;
  date: string;
  symptoms: string;
  notes: string;
  doctor?: {
    name: string;
  };
}

interface PaginatedConsultations {
  data: Consultation[];
  nextCursor: string | null;
}

interface PaginatedPatients {
  data: Patient[];
  nextCursor: string | null;
}

export default function ConsultationsPage() {
  const { pushToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [consultationsCursor, setConsultationsCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedPatientId, setLoadedPatientId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: "",
    symptoms: "",
    notes: "",
  });

  const loadConsultations = useCallback(
    async (patientId: string) => {
      try {
        const resp = await apiFetch<PaginatedConsultations>(`/consultations/${patientId}?limit=20`, { auth: true });
        setConsultations(resp.data);
        setConsultationsCursor(resp.nextCursor);
      } catch (error) {
        setConsultations([]);
        setConsultationsCursor(null);
        pushToast(error instanceof Error ? error.message : "Unable to load consultations.", "error");
      } finally {
        setLoadedPatientId(patientId);
      }
    },
    [pushToast],
  );

  const loadMoreConsultations = useCallback(async () => {
    if (!consultationsCursor || !selectedPatientId || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const resp = await apiFetch<PaginatedConsultations>(
        `/consultations/${selectedPatientId}?limit=20&cursor=${consultationsCursor}`,
        { auth: true },
      );
      setConsultations((prev) => [...prev, ...resp.data]);
      setConsultationsCursor(resp.nextCursor);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to load more consultations.", "error");
    } finally {
      setIsLoadingMore(false);
    }
  }, [consultationsCursor, selectedPatientId, isLoadingMore, pushToast]);

  useEffect(() => {
    apiFetch<PaginatedPatients>("/patients?limit=100", { auth: true })
      .then((resp) => {
        setPatients(resp.data);
        if (resp.data[0]) {
          setSelectedPatientId(resp.data[0].id);
        }
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "Unable to load patients.", "error");
      });
  }, [pushToast]);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    loadConsultations(selectedPatientId);
  }, [loadConsultations, selectedPatientId]);

  const isLoading = selectedPatientId !== "" && loadedPatientId !== selectedPatientId;

  async function handleCreateConsultation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPatientId) {
      pushToast("Select a patient first.", "error");
      return;
    }

    if (!form.date || !form.symptoms.trim() || !form.notes.trim()) {
      pushToast("Date, symptoms, and notes are required.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch<Consultation>("/consultations", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          patientId: selectedPatientId,
          date: form.date,
          symptoms: form.symptoms.trim(),
          notes: form.notes.trim(),
        }),
      });

      setForm({ date: "", symptoms: "", notes: "" });
      await loadConsultations(selectedPatientId);
      pushToast("Consultation created successfully.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to create consultation.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="panel">
        <SectionHeader
          title="Consultation Timeline"
          description="Chronological patient consultations for continuity of care."
        />

        <div className="field" style={{ marginBottom: "0.9rem" }}>
          <label htmlFor="patient-select">Patient</label>
          <select
            id="patient-select"
            value={selectedPatientId}
            onChange={(event) => setSelectedPatientId(event.target.value)}
          >
            <option value="">Select patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleCreateConsultation} aria-busy={isSubmitting}>
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="consultation-date">Consultation date</label>
            <input
              id="consultation-date"
              type="datetime-local"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="consultation-symptoms">Symptoms</label>
            <textarea
              id="consultation-symptoms"
              value={form.symptoms}
              onChange={(event) => setForm((current) => ({ ...current, symptoms: event.target.value }))}
              required
              rows={2}
            />
          </div>

          <div className="field">
            <label htmlFor="consultation-notes">Clinical notes</label>
            <textarea
              id="consultation-notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              required
              rows={3}
            />
          </div>

          <div className="button-row auth-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !selectedPatientId}>
              {isSubmitting ? "Saving..." : "Add Consultation"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-busy={isLoading}>
        <SectionHeader title="Patient Timeline" />

        {isLoading ? <p className="muted">Loading consultations...</p> : null}

        {!isLoading && selectedPatientId && consultations.length === 0 ? (
          <p className="muted">No consultations for this patient.</p>
        ) : null}

        {!selectedPatientId ? <p className="muted">Select a patient to view consultations.</p> : null}

        {consultations.map((consultation) => (
          <div className="panel timeline-item" key={consultation.id}>
            <p>
              <strong>{formatDate(consultation.date)}</strong>
            </p>
            <p className="muted">Doctor: {consultation.doctor?.name ?? "Assigned doctor"}</p>
            <p className="muted">Symptoms: {consultation.symptoms}</p>
            <p className="muted">Notes: {consultation.notes}</p>
          </div>
        ))}

        {consultationsCursor && (
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button className="btn btn-secondary" onClick={loadMoreConsultations} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
