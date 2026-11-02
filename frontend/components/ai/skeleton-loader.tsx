import { Clock3, FileText, RotateCw } from "lucide-react";

interface SkeletonLoaderProps {
  jobState?: string | null;
}
const STATE_LABELS = {
  queued: { label: "Summary queued", Icon: Clock3 },
  waiting: { label: "Waiting to prepare the summary", Icon: Clock3 },
  active: { label: "Preparing the clinical summary", Icon: FileText },
  delayed: { label: "Preparation delayed · Retrying shortly", Icon: RotateCw },
};
export function SkeletonLoader({ jobState }: SkeletonLoaderProps) {
  const state = STATE_LABELS[jobState as keyof typeof STATE_LABELS] ?? {
    label: "Preparing the clinical summary",
    Icon: FileText,
  };
  return (
    <div
      className="skeleton-container"
      role="status"
      aria-label="Generating summary"
    >
      <div className="skeleton-status">
        <span className="skeleton-status-icon">
          <state.Icon size={18} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="skeleton-status-label">{state.label}</span>
      </div>
      <div className="skeleton-lines" aria-hidden="true">
        <div className="skeleton-line skeleton-line-header" />
        <div className="skeleton-line skeleton-line-short" />
        <div className="skeleton-spacer" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-medium" />
        <div className="skeleton-spacer" />
        <div className="skeleton-line skeleton-line-header" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-short" />
      </div>
    </div>
  );
}
