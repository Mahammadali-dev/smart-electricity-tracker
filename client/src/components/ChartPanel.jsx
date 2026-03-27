export default function ChartPanel({ title, subtitle, data, accent = "amber" }) {
  const maxValue = Math.max(...data.values, 1);

  return (
    <article className="panel chart-card cinematic-card">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="chart-bars">
        {data.values.map((value, index) => (
          <div key={`${data.labels[index]}-${index}`} className="chart-column">
            <span className="chart-value">{value}</span>
            <div className="chart-track">
              <div
                className={`chart-fill ${accent}`}
                style={{ height: `${Math.max(12, (value / maxValue) * 100)}%` }}
              />
            </div>
            <small>{data.labels[index]}</small>
          </div>
        ))}
      </div>
    </article>
  );
}
