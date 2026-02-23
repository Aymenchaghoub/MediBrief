"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast-provider";
import { StreamingMarkdown } from "@/components/ai/streaming-markdown";
import { SkeletonLoader } from "@/components/ai/skeleton-loader";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

/* ── types ─────────────────────────────────────────────────────── */

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface QueuedResponse {
  jobId: string;
  status: string;
  message: string;
}

interface SSEEvent {
  state: string;
  summaryId: string | null;
  failedReason: string | null;
}

interface SummaryResponse {
  id: string;
  summaryText: string;
  riskFlags: Record<string, unknown>;
  createdAt: string;
}

interface HistorySummary {
  id: string;
  summaryText: string;
  createdAt: string;
}

/* ── constants ─────────────────────────────────────────────────── */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const PLACEHOLDER_TEXT =
  "Select a patient and click **Generate New Summary** to create an AI-assisted clinical monitoring report.\n\nThe summary will stream in real-time — analyzing vitals, lab results, and consultation history.";

/* ── component ─────────────────────────────────────────────────── */

export default function AiSummaryPage() {
  const { pushToast } = useToast();

  /* patients */
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  /* generation */
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobState, setJobState] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState(false);
  const [streamImmediate, setStreamImmediate] = useState(true);

  /* history */
  const [history, setHistory] = useState<HistorySummary[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  /* exports */
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  /* SSE ref */
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => closeStream();
  }, [closeStream]);

  /* ── load patients ────────────────────────────────────────────── */

  useEffect(() => {
    apiFetch<{ data: Patient[]; nextCursor: string | null }>("/patients?limit=100", { auth: true })
      .then((resp) => {
        setPatients(resp.data);
        if (resp.data[0]) {
          setSelectedPatientId(resp.data[0].id);
        }
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "Unable to load patients.", "error");
      })
      .finally(() => setIsLoadingPatients(false));
  }, [pushToast]);

  /* ── load summary history when patient changes ────────────────── */

  useEffect(() => {
    if (!selectedPatientId) {
      setHistory([]);
      return;
    }
    apiFetch<HistorySummary[]>(`/ai/summaries/patient/${selectedPatientId}`, { auth: true })
      .then((data) => setHistory(data))
      .catch(() => setHistory([]));
  }, [selectedPatientId]);

  /* ── SSE stream ───────────────────────────────────────────────── */

  const startSSEStream = useCallback(
    (jobId: string) => {
      closeStream();

      const token = getToken();
      const url = `${API_BASE_URL}/ai/stream/${jobId}?token=${encodeURIComponent(token ?? "")}`;
      const source = new EventSource(url);
      eventSourceRef.current = source;

      source.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          setJobState(data.state);

          if (data.state === "completed" && data.summaryId) {
            closeStream();
            const summary = await apiFetch<SummaryResponse>(`/ai/summaries/${data.summaryId}`, { auth: true });
            setStreamImmediate(false); // enable typewriter animation
            setSummaryText(summary.summaryText);
            setHasGeneratedSummary(true);
            setIsGenerating(false);
            setJobState(null);
            pushToast("Clinical summary generated.", "success");

            // Refresh history
            apiFetch<HistorySummary[]>(`/ai/summaries/patient/${selectedPatientId}`, { auth: true })
              .then((data) => setHistory(data))
              .catch(() => {});
          } else if (data.state === "failed") {
            closeStream();
            const reason = data.failedReason ?? "Unknown error.";
            setStreamImmediate(false);
            setSummaryText(`## Generation Failed\n\n${reason}`);
            setHasGeneratedSummary(false);
            setIsGenerating(false);
            setJobState(null);
            pushToast("Summary generation failed.", "error");
          } else if (data.state === "timeout") {
            closeStream();
            setSummaryText("## Timed Out\n\nSummary generation timed out. Please try again.");
            setIsGenerating(false);
            setJobState(null);
            pushToast("Generation timed out.", "error");
          }
        } catch {
          // Ignore non-JSON heartbeats
        }
      };

      source.onerror = () => {
        closeStream();
        setIsGenerating(false);
        setJobState(null);
        pushToast("Lost connection to generation stream.", "error");
      };
    },
    [closeStream, pushToast, selectedPatientId],
  );

  /* ── generate ─────────────────────────────────────────────────── */

  async function handleGenerate() {
    if (!selectedPatientId) {
      pushToast("Please select a patient first.", "error");
      return;
    }

    setIsGenerating(true);
    setJobState("queued");
    setSummaryText("");
    setHasGeneratedSummary(false);
    setSelectedHistoryId(null);

    try {
      const response = await apiFetch<QueuedResponse>(`/ai/generate-summary/${selectedPatientId}`, {
        method: "POST",
        auth: true,
      });

      startSSEStream(response.jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate summary.";
      setSummaryText(`## Error\n\n${message}`);
      setHasGeneratedSummary(false);
      setIsGenerating(false);
      setJobState(null);
      pushToast(message, "error");
    }
  }

  /* ── view a history item ──────────────────────────────────────── */

  function viewHistorySummary(item: HistorySummary) {
    setSelectedHistoryId(item.id);
    setStreamImmediate(true); // no typewriter for history
    setSummaryText(item.summaryText);
    setHasGeneratedSummary(true);
  }

  /* ── exports ──────────────────────────────────────────────────── */

  function getSelectedPatientName() {
    const patient = patients.find((p) => p.id === selectedPatientId);
    return patient ? `${patient.firstName}-${patient.lastName}`.toLowerCase() : "patient";
  }

  function exportAsText() {
    if (!summaryText.trim()) return pushToast("No summary content to export.", "error");

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
    if (!summaryText.trim()) return pushToast("No summary content to export.", "error");

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

  /* ── render ───────────────────────────────────────────────────── */

  return (
    <section className="panel" aria-busy={isGenerating || isLoadingPatients}>
      <SectionHeader
        title="AI Clinical Summary"
        description="Real-time AI-generated monitoring insights from vitals, labs, and consultations via SSE-powered pipeline."
      />

      {/* Patient selector */}
      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="summary-patient">Patient</label>
        <select
          id="summary-patient"
          value={selectedPatientId}
          onChange={(e) => {
            setSelectedPatientId(e.target.value);
            setSelectedHistoryId(null);
            setSummaryText("");
            setHasGeneratedSummary(false);
          }}
          disabled={isLoadingPatients || patients.length === 0 || isGenerating}
        >
          <option value="">Select patient</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      {!isLoadingPatients && patients.length === 0 && (
        <p className="muted" style={{ marginBottom: "0.8rem" }}>
          Add a patient first to generate AI summaries.
        </p>
      )}

      {/* Main content area */}
      <div className="ai-summary-content">
        {isGenerating ? (
          <SkeletonLoader jobState={jobState} />
        ) : summaryText ? (
          <div className="ai-summary-output">
            <StreamingMarkdown
              content={summaryText}
              speed={6}
              immediate={streamImmediate}
              onComplete={() => setStreamImmediate(true)}
            />
          </div>
        ) : (
          <div className="ai-summary-output ai-summary-placeholder">
            <StreamingMarkdown content={PLACEHOLDER_TEXT} immediate />
          </div>
        )}

        <p className="ai-disclaimer muted">
          Disclaimer: AI-generated monitoring support only. This is not a diagnosis.
        </p>
      </div>

      {/* Actions */}
      <div className="button-row auth-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || isLoadingPatients || patients.length === 0}
        >
          {isGenerating ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Generating...
            </>
          ) : (
            "Generate New Summary"
          )}
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

      {/* Summary history */}
      {history.length > 0 && (
        <div className="ai-history" style={{ marginTop: "1.2rem" }}>
          <h3 className="ai-history-title">Previous Summaries</h3>
          <div className="ai-history-list">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ai-history-item ${selectedHistoryId === item.id ? "ai-history-item-active" : ""}`}
                onClick={() => viewHistorySummary(item)}
              >
                <span className="ai-history-date">
                  {new Date(item.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="ai-history-preview">
                  {item.summaryText.slice(0, 80).replace(/[#*_]/g, "")}...
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
