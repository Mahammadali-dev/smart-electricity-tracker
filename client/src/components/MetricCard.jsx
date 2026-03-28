import { memo } from "react";

function MetricCard({ label, value, note, tone = "default" }) {
  return (
    <article className={`metric-card cinematic-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export default memo(MetricCard);
