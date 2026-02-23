"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";

interface AISummary {
  id: string;
  summaryText: string;
  createdAt: string;
}

export default function MySummariesPage() {
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    portalFetch<AISummary[]>("/portal/summaries")
      .then(setSummaries)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="muted" style={{ padding: "2rem" }}>Loading summaries…</p>;
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
          <EmptyState icon="🤖" title="No AI summaries yet" description="Once your care team generates an AI summary, it will appear here." />
        </div>
      ) : (
        summaries.map((s) => (
          <div
            key={s.id}
            className="panel portal-summary-card"
            style={{ marginBottom: "0.8rem", cursor: "pointer" }}
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setExpanded(expanded === s.id ? null : s.id);
            }}
            role="button"
            tabIndex={0}
            aria-expanded={expanded === s.id}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 600 }}>Summary — {formatDate(s.createdAt)}</p>
                <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.15rem" }}>
                  ID: {s.id.slice(0, 8)}… · Click to {expanded === s.id ? "collapse" : "expand"}
                </p>
              </div>
              <span style={{ fontSize: "1.2rem", transition: "transform 0.2s", transform: expanded === s.id ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▾
              </span>
            </div>

            {expanded === s.id && (
              <pre className="portal-summary-text" style={{ marginTop: "0.8rem" }}>
                {s.summaryText}
              </pre>
            )}
          </div>
        ))
      )}
    </>
  );
}
