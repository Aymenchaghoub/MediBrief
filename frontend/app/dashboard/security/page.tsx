"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api";

interface AuditRecord {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditResponse {
  page: number;
  limit: number;
  total: number;
  records: AuditRecord[];
}

const ACTION_OPTIONS = [
  "",
  "LOGIN",
  "PATIENT_CREATE",
  "PATIENT_UPDATE",
  "PATIENT_ARCHIVE",
  "CONSULTATION_CREATE",
  "VITAL_CREATE",
  "LAB_RESULT_CREATE",
  "AI_SUMMARY_GENERATE",
];

const ENTITY_TYPE_OPTIONS = [
  "",
  "AUTH",
  "PATIENT",
  "CONSULTATION",
  "VITAL",
  "LAB_RESULT",
  "AI_SUMMARY",
];

export default function SecurityPage() {
  const { pushToast } = useToast();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadAuditLogs = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(limit),
        });
        if (actionFilter) params.set("action", actionFilter);
        if (entityTypeFilter) params.set("entityType", entityTypeFilter);

        const resp = await apiFetch<AuditResponse>(`/audit?${params.toString()}`, { auth: true });
        setRecords(resp.records);
        setTotal(resp.total);
        setPage(resp.page);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Unable to load audit logs.", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [actionFilter, entityTypeFilter, pushToast],
  );

  useEffect(() => {
    loadAuditLogs(1);
  }, [loadAuditLogs]);

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function actionBadgeClass(action: string): string {
    if (action.includes("CREATE")) return "badge badge-safe";
    if (action.includes("ARCHIVE") || action.includes("DELETE")) return "badge badge-critical";
    if (action.includes("UPDATE")) return "badge badge-warn";
    if (action === "LOGIN") return "badge badge-info";
    return "badge";
  }

  return (
    <>
      <section className="panel">
        <SectionHeader
          title="Enterprise Audit Dashboard"
          description="Full compliance audit trail — admin-only visibility into every system action."
        />

        <div className="grid-4" style={{ marginBottom: "1rem" }}>
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="action-filter">Action</label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {ACTION_OPTIONS.filter(Boolean).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="entity-filter">Entity Type</label>
            <select
              id="entity-filter"
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
            >
              <option value="">All Entities</option>
              {ENTITY_TYPE_OPTIONS.filter(Boolean).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="muted" style={{ marginBottom: "0.5rem" }}>
          Total records: <strong>{total}</strong> — Page {page} of {totalPages}
        </p>
      </section>

      <section className="panel" aria-busy={isLoading}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>Loading audit logs...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6}>No audit records match the current filters.</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatTimestamp(record.timestamp)}</td>
                    <td>{record.user.name}</td>
                    <td>{record.user.role}</td>
                    <td>
                      <span className={actionBadgeClass(record.action)}>{record.action}</span>
                    </td>
                    <td>{record.entityType}</td>
                    <td>
                      <code style={{ fontSize: "0.75rem" }}>{record.entityId.slice(0, 8)}…</code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="button-row" style={{ marginTop: "1rem", gap: "0.5rem" }}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1 || isLoading}
            onClick={() => loadAuditLogs(page - 1)}
          >
            ← Previous
          </button>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages || isLoading}
            onClick={() => loadAuditLogs(page + 1)}
          >
            Next →
          </button>
        </div>
      </section>
    </>
  );
}
