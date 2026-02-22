interface SparklineProps {
  points: number[];
}

export function Sparkline({ points }: SparklineProps) {
  if (points.length < 2) {
    return <div className="sparkline-placeholder" />;
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="sparkline-wrap" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={coordinates} />
      </svg>
    </div>
  );
}
