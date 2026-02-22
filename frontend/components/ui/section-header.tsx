interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h3 className="section-title">{title}</h3>
      {description ? <p className="muted section-description">{description}</p> : null}
    </div>
  );
}
