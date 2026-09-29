/**
 * Charts.
 *
 * Hand-built SVG rather than a charting dependency. The dashboard needs four
 * simple shapes, and a full library would add far more weight than the whole
 * rest of the visualisation layer. Every chart:
 *   - scales off a `viewBox` so it is resolution independent
 *   - draws an explicit empty state instead of a misleading flat line
 *   - guards against a zero range (all-equal values), the classic source of
 *     `NaN` in hand-rolled path maths
 */

import { useId, useMemo, useState } from "react";

/** @param {number[]} values */
function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (min === Infinity) return { min: 0, max: 0 };
  return { min, max };
}

/**
 * Map values into an SVG path.
 * @param {number[]} values
 * @param {number} width @param {number} height @param {number} padding
 */
function linePath(values, width, height, padding) {
  if (values.length < 2) return "";
  const { min, max } = extent(values);
  const range = max - min || 1; // a flat series would divide by zero
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = innerW / (values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + index * stepX;
      const y = padding + innerH - ((value - min) / range) * innerH;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function areaPath(values, width, height, padding) {
  const line = linePath(values, width, height, padding);
  if (!line) return "";
  const { min, max } = extent(values);
  const range = max - min || 1;
  const innerH = height - padding * 2;
  const firstY = padding + innerH - ((values[0] - min) / range) * innerH;
  return `${line} L${(width - padding).toFixed(2)},${(height - padding).toFixed(2)} L${padding},${(height - padding).toFixed(2)} L${padding},${firstY.toFixed(2)} Z`;
}

function pointAt(values, width, height, padding, index) {
  const { min, max } = extent(values);
  const range = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  return {
    x: padding + index * stepX,
    y: padding + innerH - ((values[index] - min) / range) * innerH,
    value: values[index],
  };
}

const VIEW_W = 320;
const VIEW_H = 120;
const PAD = 8;

/* -------------------------------------------------------------------------- */
/* Sparkline                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {number[]} props.values
 * @param {string} [props.tone]  a CSS colour value
 * @param {number} [props.height]
 * @param {boolean} [props.area]
 * @param {string} [props.label]
 */
export function Sparkline({ values, tone = "var(--chart-1)", height = 34, area = true, label = "trend" }) {
  const gradientId = useId();
  const clean = useMemo(() => (values ?? []).map((v) => Number(v) || 0), [values]);
  const hasData = clean.length > 1 && new Set(clean).size > 1;

  if (!hasData) {
    return (
      <span
        className="sparkline"
        style={{ height }}
        aria-hidden="true"
        title={clean.length ? `steady at ${clean.at(-1)}` : "no data yet"}
      >
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ height: "100%" }}>
          <line
            x1="0"
            x2="100"
            y1="5"
            y2="5"
            stroke="var(--border-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="3 4"
          />
        </svg>
      </span>
    );
  }

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.3" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath(clean, 100, height, 2)} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path
        className="sparkline__line"
        d={linePath(clean, 100, height, 2)}
        stroke={tone}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Area chart with hover crosshair                                            */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {number[]} props.values
 * @param {string[]} [props.labels] x-axis captions, same length as `values`
 * @param {string} [props.tone]
 * @param {string} [props.label]
 * @param {string} [props.unit]
 */
export function AreaChart({ values, labels, tone = "var(--chart-1)", label = "chart", unit = "" }) {
  const gradientId = useId();
  const [hover, setHover] = useState(null);

  const clean = useMemo(() => (values ?? []).map((v) => Number(v) || 0), [values]);
  const { min, max } = extent(clean);
  const hasData = clean.length > 1 && new Set(clean).size > 1;

  const onMove = (event) => {
    if (!hasData) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (clean.length - 1));
    setHover(Math.max(0, Math.min(clean.length - 1, index)));
  };

  const gridYs = [0.25, 0.5, 0.75].map((f) => PAD + (VIEW_H - PAD * 2) * f);
  const active = hover != null ? pointAt(clean, VIEW_W, VIEW_H, PAD, hover) : null;

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}. Latest ${clean.at(-1) ?? 0}${unit}, peak ${max}${unit}, low ${min}${unit}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <g className="chart__grid">
          {gridYs.map((y) => (
            <line key={y} x1={PAD} x2={VIEW_W - PAD} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {hasData ? (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tone} stopOpacity="0.32" />
                <stop offset="100%" stopColor={tone} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path className="chart__area" d={areaPath(clean, VIEW_W, VIEW_H, PAD)} fill={`url(#${gradientId})`} />
            <path className="chart__line" d={linePath(clean, VIEW_W, VIEW_H, PAD)} stroke={tone} />
            {active ? (
              <>
                <line
                  className="chart__hover-line"
                  x1={active.x}
                  x2={active.x}
                  y1={PAD}
                  y2={VIEW_H - PAD}
                />
                <circle
                  className="chart__point"
                  cx={active.x}
                  cy={active.y}
                  r="3.5"
                  fill={tone}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </>
        ) : (
          <g className="chart__idle">
            <line
              x1={PAD}
              x2={VIEW_W - PAD}
              y1={VIEW_H - PAD}
              y2={VIEW_H - PAD}
              stroke="var(--border-strong)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={VIEW_W / 2}
              y={VIEW_H / 2 + 5}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="12"
              fontWeight="500"
              fontFamily="var(--font-sans, inherit)"
            >
              Zero backlog · Queue is idle (0 waiting)
            </text>
          </g>
        )}
      </svg>

      {active ? (
        <div
          className="chart-tip"
          style={{
            left: `${(active.x / VIEW_W) * 100}%`,
            top: `${(active.y / VIEW_H) * 100}%`,
          }}
        >
          {labels?.[hover] ? <div className="chart-tip__label">{labels[hover]}</div> : null}
          <div className="chart-tip__value">
            {active.value}
            {unit}
          </div>
        </div>
      ) : null}

      {labels?.length ? (
        <div className="chart__axis">
          <span className="chart__axis-label">{labels[0]}</span>
          <span className="chart__axis-label">{labels.at(-1)}</span>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Donut                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {Array<{key:string,label:string,value:number,color?:string}>} props.segments
 * @param {number} [props.size]
 * @param {number} [props.thickness]
 * @param {string|number} [props.centerValue]
 * @param {string} [props.centerCaption]
 * @param {string|null} [props.activeKey] pressed segment, for click-to-filter
 * @param {(key:string)=>void} [props.onSelect]
 */
export function Donut({
  segments,
  size = 156,
  thickness = 15,
  centerValue,
  centerCaption,
  activeKey = null,
  onSelect,
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0);

  let offset = 0;
  const arcs = segments.map((segment) => {
    const value = Number(segment.value) || 0;
    const dash = total > 0 ? (value / total) * circumference : 0;
    const arc = {
      ...segment,
      fraction: total > 0 ? value / total : 0,
      dasharray: `${Math.max(0, dash - 2)} ${circumference}`,
      dashoffset: -offset,
    };
    offset += dash;
    return arc;
  });

  return (
    <div className="donut">
      <div className="donut__figure" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Status distribution">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--bg-inset)"
              strokeWidth={thickness}
            />
            {total > 0
              ? arcs.map((arc) => (
                  <circle
                    key={arc.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={arc.color ?? "var(--chart-1)"}
                    strokeWidth={thickness}
                    strokeDasharray={arc.dasharray}
                    strokeDashoffset={arc.dashoffset}
                  >
                    <title>{`${arc.label}: ${arc.value}`}</title>
                  </circle>
                ))
              : null}
          </g>
        </svg>
        <div className="donut__center">
          <div className="donut__total">{centerValue ?? total}</div>
          {centerCaption ? <div className="donut__caption">{centerCaption}</div> : null}
        </div>
      </div>

      <div className="donut__legend">
        {segments.map((segment) => {
          const value = Number(segment.value) || 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          const Element = onSelect ? "button" : "div";
          return (
            <Element
              key={segment.key}
              className="donut__row"
              {...(onSelect
                ? { type: "button", "aria-pressed": activeKey === segment.key, onClick: () => onSelect(segment.key) }
                : {})}
            >
              <span className="donut__swatch" style={{ background: segment.color ?? "var(--chart-1)" }} />
              <span className="donut__name">{segment.label}</span>
              <span className="donut__value">{value}</span>
              <span className="donut__pct">{pct}%</span>
            </Element>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Capacity meter                                                             */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {number} props.value current occupancy
 * @param {number} props.max capacity
 * @param {'normal'|'warning'|'danger'|'brand'} [props.tone]
 * @param {string} [props.label]
 * @param {string} [props.note]
 */
export function CapacityMeter({ value, max, tone = "normal", label = "Queue capacity", note, threshold = 0.8 }) {
  const safeMax = Number(max) > 0 ? Number(max) : 1;
  const pct = Math.max(0, Math.min(100, (Number(value) / safeMax) * 100));
  const shown = Math.round(pct);

  return (
    <div className="meter" data-tone={tone}>
      <div className="meter__head">
        <div className="meter__figure">
          <span className="meter__value">{shown}%</span>
          <span className="meter__max">
            {Number(value) || 0} / {safeMax.toLocaleString()}
          </span>
        </div>
        {note ? <span className="meter__pct">{note}</span> : null}
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={Number(value) || 0}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
      >
        <div className="meter__fill" style={{ width: `${shown}%` }} />
        <span className="meter__threshold" style={{ left: `${threshold * 100}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat tile                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {string} [props.unit]
 * @param {import('react').ReactNode} [props.icon]
 * @param {'neutral'|'pending'|'processing'|'completed'|'failed'|'retrying'|'dead'|'cancelled'} [props.tone]
 * @param {number[]} [props.spark]
 * @param {import('react').ReactNode} [props.foot]
 * @param {() => void} [props.onClick] makes the tile a button
 */
export function StatTile({ label, value, unit, icon, tone = "neutral", spark, foot, onClick, highlight }) {
  const Element = onClick ? "button" : "div";
  return (
    <Element
      className="stat card"
      data-tone={tone}
      data-highlight={highlight ? "true" : undefined}
      {...(onClick ? { type: "button", onClick } : {})}
    >
      <div className="stat__head">
        <span className="stat__label">{label}</span>
        {icon ? <span className="stat__icon">{icon}</span> : null}
      </div>
      <div className="stat__value">
        {value}
        {unit ? <span className="stat__unit">{unit}</span> : null}
      </div>
      <div className="stat__foot">
        {foot}
        {spark?.length > 1 ? (
          <span className="stat__spark" style={{ width: 64 }}>
            <Sparkline
              values={spark}
              height={22}
              tone={`var(--status-${tone})`}
              label={`${label} trend`}
            />
          </span>
        ) : null}
      </div>
    </Element>
  );
}
