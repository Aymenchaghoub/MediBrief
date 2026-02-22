"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface SummaryResponse {
  summaryText: string;
}

export default function AiSummaryPage() {
  const { pushToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [summaryText, setSummaryText] = useState<string>(
    "Generate a summary to display AI-assisted clinical monitoring insights.",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState(false);

  useEffect(() => {
    apiFetch<Patient[]>("/patients", { auth: true })
      .then((data) => {
        setPatients(data);
        if (data[0]) {
          setSelectedPatientId(data[0].id);
        }
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "Unable to load patients.", "error");
      })
      .finally(() => setIsLoadingPatients(false));
  }, [pushToast]);

  async function handleGenerate() {
    if (!selectedPatientId) {
      pushToast("Please select a patient first.", "error");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiFetch<SummaryResponse>(`/ai/generate-summary/${selectedPatientId}`, {
        method: "POST",
        auth: true,
      });
      setSummaryText(response.summaryText);
      setHasGeneratedSummary(true);
      pushToast("Clinical summary generated.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate summary.";
      setSummaryText(message);
      setHasGeneratedSummary(false);
      pushToast(message, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  function getSelectedPatientName() {
    const patient = patients.find((entry) => entry.id === selectedPatientId);
    if (!patient) {
      return "patient";
    }

    return `${patient.firstName}-${patient.lastName}`.toLowerCase();
  }

  function exportAsText() {
    if (!summaryText.trim()) {
      pushToast("No summary content to export.", "error");
      return;
    }

    const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medibrief-summary-${getSelectedPatientName()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast("Summary exported as .txt", "success");
  }

  async function exportAsPdf() {
    if (!summaryText.trim()) {
      pushToast("No summary content to export.", "error");
      return;
    }

    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;

      doc.setFontSize(16);
      doc.text("MediBrief Clinical Summary", margin, margin);
      doc.setFontSize(10);
      doc.text("AI-generated monitoring support only.", margin, margin + 18);

      const lines = doc.splitTextToSize(summaryText, maxWidth);
      doc.setFontSize(11);
      doc.text(lines, margin, margin + 44);
      doc.save(`medibrief-summary-${getSelectedPatientName()}.pdf`);
      pushToast("Summary exported as .pdf", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to export PDF.", "error");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <section className="panel" aria-busy={isGenerating || isLoadingPatients}>
      <SectionHeader
        title="AI Clinical Summary"
        description="Generated from vitals, lab records, and recent consultations."
      />

      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="summary-patient">Patient</label>
        <select
          id="summary-patient"
          value={selectedPatientId}
          onChange={(event) => setSelectedPatientId(event.target.value)}
          disabled={isLoadingPatients || patients.length === 0}
        >
          <option value="">Select patient</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.firstName} {patient.lastName}
            </option>
          ))}
        </select>
      </div>

      {!isLoadingPatients && patients.length === 0 ? (
        <p className="muted" style={{ marginBottom: "0.8rem" }}>
          Add a patient first to generate AI summaries.
        </p>
      ) : null}

      <div className="panel timeline-item">
        <p style={{ marginBottom: "0.6rem", whiteSpace: "pre-wrap" }}>{summaryText}</p>
        <p className="muted">Disclaimer: AI-generated monitoring support only. This is not a diagnosis.</p>
      </div>

      <div className="button-row auth-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || isLoadingPatients || patients.length === 0}
        >
          {isGenerating ? "Generating..." : "Generate New Summary"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={exportAsText} disabled={!hasGeneratedSummary}>
          Export .txt
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={exportAsPdf}
          disabled={isExportingPdf || !hasGeneratedSummary}
        >
          {isExportingPdf ? "Exporting PDF..." : "Export .pdf"}
        </button>
      </div>
    </section>
  );
}
