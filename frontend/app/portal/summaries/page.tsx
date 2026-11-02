"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronDown } from "lucide-react";
import { StreamingMarkdown } from "@/components/ai/streaming-markdown";

interface AISummary {
  id: string;
  summaryText: string;
  createdAt: string;
}

export default function MySummariesPage() {
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    portalFetch<AISummary[]>("/portal/summaries")
      .then(setSummaries)
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
        Loading summaries…
      </p>
    );
  }

  if (loadError) {
    return (
      <section className="panel">
        <h2 className="section-title">My summaries</h2>
        <p className="form-error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">My AI Summaries</h2>
        <p className="muted section-description">
          AI-generated health summaries created by your care team.
        </p>
      </div>

      {summaries.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="summary"
            title="No AI summaries yet"
            description="Once your care team generates an AI summary, it will appear here."
          />
        </div>
      ) : (
        summaries.map((s) => (
          <article key={s.id} className="panel portal-summary-card">
            <button
              type="button"
              className="portal-summary-toggle"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              aria-expanded={expanded === s.id}
              aria-controls={`summary-${s.id}`}
            >
              <span>
                <span style={{ display: "block", fontWeight: 500 }}>
                  Summary · {formatDate(s.createdAt)}
                </span>
                <span
                  className="muted"
                  style={{ display: "block", fontSize: 13, marginTop: 8 }}
                >
                  Record {s.id.slice(0, 8)} ·{" "}
                  {expanded === s.id ? "Hide summary" : "Read summary"}
                </span>
              </span>
              <ChevronDown
                size={18}
                strokeWidth={1.5}
                aria-hidden="true"
                style={{
                  transform: expanded === s.id ? "rotate(180deg)" : undefined,
                }}
              />
            </button>
            <div
              id={`summary-${s.id}`}
              hidden={expanded !== s.id}
              className="portal-summary-text"
              style={{ marginTop: 24 }}
            >
              {expanded === s.id && (
                <StreamingMarkdown content={s.summaryText} immediate />
              )}
            </div>
          </article>
        ))
      )}
    </>
  );
}
