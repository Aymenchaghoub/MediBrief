"use client";

interface SkeletonLoaderProps {
  /** Current job state shown alongside the skeleton. */
  jobState?: string | null;
}

const STATE_LABELS: Record<string, { label: string; icon: string }> = {
  queued: { label: "Queued — waiting for worker...", icon: "🕐" },
  waiting: { label: "Waiting — in queue...", icon: "⏳" },
  active: { label: "Processing — AI generating summary...", icon: "🧠" },
  delayed: { label: "Delayed — will retry shortly...", icon: "🔄" },
};

/**
 * A shimmering skeleton loader displayed while the AI summary is being generated.
 * Mimics a document layout with animated gradient bars.
 */
export function SkeletonLoader({ jobState }: SkeletonLoaderProps) {
  const stateInfo = jobState ? STATE_LABELS[jobState] : null;

  return (
    <div className="skeleton-container" role="status" aria-label="Generating summary">
      {/* Status indicator */}
      {stateInfo && (
        <div className="skeleton-status">
          <span className="skeleton-status-icon">{stateInfo.icon}</span>
          <span className="skeleton-status-label">{stateInfo.label}</span>
          <span className="skeleton-pulse-dot" />
        </div>
      )}

      {/* Shimmer lines mimicking a document */}
      <div className="skeleton-lines">
        <div className="skeleton-line skeleton-line-header" />
        <div className="skeleton-line skeleton-line-short" />
        <div className="skeleton-spacer" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-medium" />
        <div className="skeleton-spacer" />
        <div className="skeleton-line skeleton-line-header" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-short" />
      </div>
    </div>
  );
}
