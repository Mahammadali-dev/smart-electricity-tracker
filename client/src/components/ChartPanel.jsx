import { memo, useEffect, useMemo, useRef, useState } from "react";

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 220;
const PADDING_X = 18;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 42;

function formatValue(value) {
  const numeric = Number(value) || 0;
  if (numeric >= 100) {
    return numeric.toFixed(0);
  }
  if (numeric >= 10) {
    return numeric.toFixed(1);
  }
  return numeric.toFixed(2);
}

function buildLinePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points, viewWidth) {
  if (!points.length) {
    return "";
  }

  const baseline = VIEW_HEIGHT - PADDING_BOTTOM;
  return `${buildLinePath(points)} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

const ChartPanel = memo(function ChartPanel({ title, subtitle, data, accent = "amber", hint = "Swipe the graph to inspect exact values." }) {
  const chartRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, (data?.values?.length || 1) - 1));

  useEffect(() => {
    setActiveIndex((current) => {
      const nextLength = data?.values?.length || 0;
      if (!nextLength) {
        return 0;
      }
      return Math.min(current, nextLength - 1);
    });
  }, [data]);

  const chartIdBase = useMemo(
    () => `${accent}-${String(title || "chart").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    [accent, title]
  );

  const values = data?.values || [];
  const labels = data?.labels || [];
  const viewWidth = Math.max(VIEW_WIDTH, labels.length * 56);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const domainSpan = Math.max(1, maxValue - minValue);
  const stepX = values.length > 1 ? (viewWidth - PADDING_X * 2) / (values.length - 1) : 0;

  const points = useMemo(
    () =>
      values.map((value, index) => ({
        x: PADDING_X + stepX * index,
        y: PADDING_TOP + ((maxValue - value) / domainSpan) * (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM),
        value,
        label: labels[index] || `Point ${index + 1}`,
      })),
    [values, labels, stepX, maxValue, domainSpan]
  );

  const linePath = useMemo(() => buildLinePath(points), [points]);
  const areaPath = useMemo(() => buildAreaPath(points, viewWidth), [points, viewWidth]);
  const safeActiveIndex = points.length ? Math.min(activeIndex, points.length - 1) : 0;
  const activePoint = points[safeActiveIndex] || null;
  const averageValue = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const peakValue = values.length ? Math.max(...values) : 0;

  function updateActivePoint(clientX) {
    if (!chartRef.current || !points.length) {
      return;
    }

    const bounds = chartRef.current.getBoundingClientRect();
    const relative = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
    const ratio = bounds.width ? relative / bounds.width : 0;
    const nextIndex = Math.round(ratio * (points.length - 1));
    setActiveIndex(nextIndex);
  }

  return (
    <article className={`panel chart-card cinematic-card chart-card-${accent}`}>
      <div className="panel-head chart-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="chart-head-meta">
          <span className="chart-pill">{activePoint?.label || "Live"}</span>
          <strong>{formatValue(activePoint?.value || 0)}</strong>
          <small>{hint}</small>
        </div>
      </div>

      <div className="chart-scroll-shell">
        <div className="chart-scroll-track" style={{ minWidth: `${viewWidth}px` }}>
          <div
            ref={chartRef}
            className="chart-surface"
            style={{ width: `${viewWidth}px` }}
            onMouseMove={(event) => updateActivePoint(event.clientX)}
            onTouchStart={(event) => {
              if (event.touches[0]) {
                updateActivePoint(event.touches[0].clientX);
              }
            }}
            onTouchMove={(event) => {
              if (event.touches[0]) {
                updateActivePoint(event.touches[0].clientX);
              }
            }}
          >
            <svg viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`} className="chart-svg" role="img" aria-label={title}>
              <defs>
                <linearGradient id={`${chartIdBase}-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(0, 200, 83, 0.38)" />
                  <stop offset="100%" stopColor="rgba(0, 200, 83, 0.02)" />
                </linearGradient>
                <linearGradient id={`${chartIdBase}-line`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={accent === "smoke" ? "#6EE7A8" : "#00C853"} />
                  <stop offset="100%" stopColor="#5BE38F" />
                </linearGradient>
                <filter id={`${chartIdBase}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {[0, 1, 2, 3].map((line) => {
                const y = PADDING_TOP + ((VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) / 3) * line;
                return <line key={line} x1={PADDING_X} y1={y} x2={viewWidth - PADDING_X} y2={y} className="chart-grid-line" />;
              })}

              {activePoint ? (
                <line
                  x1={activePoint.x}
                  y1={PADDING_TOP}
                  x2={activePoint.x}
                  y2={VIEW_HEIGHT - PADDING_BOTTOM}
                  className="chart-focus-line"
                />
              ) : null}

              {areaPath ? <path d={areaPath} fill={`url(#${chartIdBase}-area)`} className="chart-area" /> : null}
              {linePath ? <path d={linePath} fill="none" stroke={`url(#${chartIdBase}-line)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${chartIdBase}-glow)`} className="chart-line" /> : null}

              {points.map((point, index) => (
                <circle
                  key={`${point.label}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === safeActiveIndex ? 6 : 4}
                  className={`chart-point ${index === safeActiveIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                />
              ))}
            </svg>

            {activePoint ? (
              <div
                className="chart-tooltip"
                style={{
                  left: `calc(${(activePoint.x / viewWidth) * 100}% - 42px)`,
                  top: `calc(${(activePoint.y / VIEW_HEIGHT) * 100}% - 52px)`,
                }}
              >
                <strong>{formatValue(activePoint.value)}</strong>
                <span>{activePoint.label}</span>
              </div>
            ) : null}

            <div className="chart-axis">
              {labels.map((label, index) => (
                <button
                  key={`${label}-${index}`}
                  type="button"
                  className={`chart-axis-button ${index === safeActiveIndex ? "active" : ""}`}
                  onClick={() => setActiveIndex(index)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-meta-row">
        <article className="chart-stat-chip">
          <span>Peak</span>
          <strong>{formatValue(peakValue)}</strong>
        </article>
        <article className="chart-stat-chip">
          <span>Average</span>
          <strong>{formatValue(averageValue)}</strong>
        </article>
        <article className="chart-stat-chip active">
          <span>Selected</span>
          <strong>{activePoint?.label || "Live"}</strong>
        </article>
      </div>
    </article>
  );
});

export default ChartPanel;



