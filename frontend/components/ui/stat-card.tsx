interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
}

export function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <article className="panel stat-card">
      <p className="muted">{label}</p>
      <p className="metric-value">{value}</p>
      {trend ? <p className="kpi-trend">{trend}</p> : null}
    </article>
  );
}
