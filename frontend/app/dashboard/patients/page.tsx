"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  phone: string | null;
  passwordHash?: string | null;
}

interface CreatePatientPayload {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  phone?: string;
}

interface PaginatedResponse {
  data: Patient[];
  nextCursor: string | null;
}

export default function PatientsPage() {
  const { pushToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePatientPayload>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "OTHER",
    phone: "",
  });

  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await apiFetch<PaginatedResponse>("/patients?limit=20", { auth: true });
      setPatients(resp.data);
      setNextCursor(resp.nextCursor);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load patients";
      setError(message);
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const resp = await apiFetch<PaginatedResponse>(`/patients?limit=20&cursor=${nextCursor}`, { auth: true });
      setPatients((prev) => [...prev, ...resp.data]);
      setNextCursor(resp.nextCursor);
    } catch (fetchError) {
      pushToast(fetchError instanceof Error ? fetchError.message : "Unable to load more patients", "error");
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, pushToast]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  async function handleInvite(patientId: string) {
    setInvitingId(patientId);
    try {
      const res = await apiFetch<{ inviteToken: string; patientName: string }>(
        `/patients/${patientId}/invite`,
        { method: "POST", auth: true },
      );
      const link = `${window.location.origin}/patient-auth?token=${res.inviteToken}`;
      setInviteLink(link);
      await navigator.clipboard.writeText(link);
      pushToast(`Invite link for ${res.patientName} copied to clipboard!`, "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Unable to generate invite", "error");
    } finally {
      setInvitingId(null);
    }
  }

  async function handleCreatePatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      pushToast("Please fill first name, last name, and date of birth.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch<Patient>("/patients", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          ...form,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone?.trim() ? form.phone.trim() : undefined,
        }),
      });

      setForm({ firstName: "", lastName: "", dateOfBirth: "", gender: "OTHER", phone: "" });
      await loadPatients();
      pushToast("Patient created successfully.", "success");
    } catch (submitError) {
      pushToast(submitError instanceof Error ? submitError.message : "Unable to create patient.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="panel">
        <SectionHeader
          title="Add Patient"
          description="Create a tenant-scoped patient record that is immediately available to consultations and AI flows."
        />

        <form onSubmit={handleCreatePatient} aria-busy={isSubmitting}>
          <div className="grid-4">
            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                required
              />
            </div>

            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                required
              />
            </div>

            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="dateOfBirth">Date of birth</label>
              <input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                required
              />
            </div>

            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                value={form.gender}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gender: event.target.value as "MALE" | "FEMALE" | "OTHER",
                  }))
                }
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>

          <div className="button-row auth-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Patient"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={loadPatients} disabled={isLoading}>
              Refresh List
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-busy={isLoading}>
        <SectionHeader
          title="Patients Registry"
          description="Tenant-scoped records with consultation and risk visibility."
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Portal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>Loading patients...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} role="alert">{error}</td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6}>No patients found in this clinic.</td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id}>
                    <td><Link href={`/dashboard/patients/${patient.id}`}>{patient.firstName} {patient.lastName}</Link></td>
                    <td>{formatDate(patient.dateOfBirth)}</td>
                    <td>{patient.gender}</td>
                    <td>{patient.phone ?? "-"}</td>
                    <td>
                      {patient.passwordHash ? (
                        <span className="badge badge-safe">Active</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }}
                          disabled={invitingId === patient.id}
                          onClick={() => handleInvite(patient.id)}
                        >
                          {invitingId === patient.id ? "…" : "Invite"}
                        </button>
                      )}
                    </td>
                    <td><span className="badge badge-safe">Tracked</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {nextCursor && (
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button className="btn btn-secondary" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {inviteLink && (
          <div className="panel" style={{ marginTop: "1rem", borderLeft: "3px solid var(--primary)" }}>
            <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.3rem" }}>
              Invite Link Generated
            </p>
            <p className="muted" style={{ fontSize: "0.82rem", wordBreak: "break-all" }}>{inviteLink}</p>
            <div className="button-row" style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.78rem" }}
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  pushToast("Link copied!", "success");
                }}
              >
                Copy Again
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.78rem" }}
                onClick={() => setInviteLink(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
