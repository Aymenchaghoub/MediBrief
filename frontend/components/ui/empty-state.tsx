import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  FolderHeart,
} from "lucide-react";

const icons = {
  activity: Activity,
  calendar: CalendarDays,
  consultations: ClipboardList,
  summary: FileText,
  labs: FlaskConical,
  records: FolderHeart,
};
interface EmptyStateProps {
  icon: keyof typeof icons;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  const Icon = icons[icon];
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn btn-secondary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
