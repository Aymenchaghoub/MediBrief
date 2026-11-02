interface SparklineProps {
  points: number[];
  dates?: string[];
  unit?: string;
  label?: string;
}

/** A dated series of real measurements. Callers never supply fallback data. */
export function Sparkline({
  points,
  dates,
  unit = "",
  label = "Recorded measurements",
}: SparklineProps) {
  if (points.length < 2) {
    return (
      <p className="chart-empty">
        At least two recorded measurements are needed to show a trend
      </p>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const timestamps = dates?.map((date) => Date.parse(date));
  const start = timestamps?.[0] ?? 0;
  const end = timestamps?.[timestamps.length - 1] ?? 0;
  const coordinates = points.map((point, index) => {
    const fraction = timestamps
      ? end === start
        ? 0.5
        : (timestamps[index] - start) / (end - start)
      : index / (points.length - 1);
    return { x: 8 + fraction * 504, y: 140 - ((point - min) / range) * 112 };
  });
  const number = (value: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  const date = (value: string) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="sparkline-wrap">
      <div className="chart-plot">
        <div className="chart-y-axis" aria-hidden="true">
          <span>{number(max)}</span>
          <span>{number(min)}</span>
        </div>
        <svg
          preserveAspectRatio="none"
          viewBox="0 0 520 168"
          role="img"
          aria-label={`${label}: ${points.length} measurements, minimum ${number(min)} ${unit}, maximum ${number(max)} ${unit}`}
        >
          {[28, 84, 140].map((y) => (
            <line
              key={y}
              x1="8"
              x2="512"
              y1={y}
              y2={y}
              className="chart-grid"
            />
          ))}
          <polyline
            className="chart-line"
            points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")}
          />
          {coordinates.map(({ x, y }, index) => (
            <circle key={index} cx={x} cy={y} r="3" className="chart-point">
              <title>
                {dates ? `${date(dates[index])}: ` : ""}
                {number(points[index])} {unit}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      {dates && (
        <div className="chart-range">
          <span>{date(dates[0])}</span>
          <span>{date(dates[dates.length - 1])}</span>
        </div>
      )}
    </div>
  );
}
