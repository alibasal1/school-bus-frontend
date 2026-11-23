// Charts for the dashboard. Owner: Yehia.
//
// Hand-drawn SVG rather than a charting library: adding Recharts or Chart.js
// would mean a new dependency for everyone on the team and a bigger bundle,
// for two charts. These are a few dozen lines each and have no build step.
//
// Choices that are not cosmetic:
//  * Colours come from the validated pair in theme.css (--series-1,
//    --series-2). The interface accent (orange) is never used for data, so a
//    button can never be mistaken for a bar.
//  * Two series therefore always carry a legend, and the table toggle means
//    identity never rests on colour alone — which is also the answer for
//    colour-blind readers, print and forced-colours mode.
//  * One vertical scale. Never two y-axes.
//  * Bars sit on the baseline with rounded tops only, with a 2px gap between
//    stacked segments so they stay countable where values are small.

import { useState } from 'react';

const CHART_HEIGHT = 190;
// A real coordinate space, scaled uniformly by the browser. An earlier
// version used a 100-unit viewBox with preserveAspectRatio="none", which
// stretches the x axis independently: text came out horizontally squashed
// and the 4px corner radii turned into ellipses.
const CHART_WIDTH = 720;
const BAR_RADIUS = 4;

/** A bar path: rounded at the top end, square where it meets what is below. */
function barPath(x, y, width, height, roundTop) {
  if (height <= 0) return '';
  const r = roundTop ? Math.min(BAR_RADIUS, width / 2, height) : 0;
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    r ? `Q ${x} ${y} ${x + r} ${y}` : '',
    `L ${x + width - r} ${y}`,
    r ? `Q ${x + width} ${y} ${x + width} ${y + r}` : '',
    `L ${x + width} ${y + height}`,
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Four gridlines and their value labels. Recessive on purpose. */
function Gridlines({ max, width, height, padLeft }) {
  const steps = 4;
  return (
    <g>
      {Array.from({ length: steps + 1 }, (_, index) => {
        const value = (max / steps) * index;
        const y = height - (value / max) * height;
        return (
          <g key={index}>
            <line className="chart-grid-line" x1={padLeft} y1={y} x2={width} y2={y} stroke="var(--grid)" />
            <text x={padLeft - 8} y={y + 3.5} textAnchor="end" fill="var(--text-muted)" fontSize="10.5">
              {Math.round(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * Trips per day, split into running and cancelled.
 *
 * Stacked rather than side by side because the question is "how many runs
 * that day, and how many of them fell through" — the total matters as much
 * as the split.
 */
export function TripsByDayChart({ days }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const max = Math.max(1, ...days.map((day) => day.active + day.cancelled));
  const padLeft = 30;
  const width = CHART_WIDTH;
  const innerWidth = width - padLeft;
  const slot = innerWidth / Math.max(days.length, 1);
  const barWidth = Math.min(slot * 0.5, 26);

  return (
    <div>
      <div className="panel-head" style={{ marginBottom: 8 }}>
        <h3>Bus days ahead</h3>
        <div className="legend">
          <span className="legend-key">
            <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
            Running
          </span>
          <span className="legend-key">
            <span className="legend-swatch" style={{ background: 'var(--series-2)' }} />
            Cancelled
          </span>
        </div>
        <button type="button" onClick={() => setShowTable((value) => !value)}>
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {showTable ? (
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Running</th>
              <th>Cancelled</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td>{day.label}</td>
                <td>{day.active}</td>
                <td>{day.cancelled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
            role="img"
            aria-label="Trips for each of the next fourteen days, split into running and cancelled"
          >
            <Gridlines max={max} width={width} height={CHART_HEIGHT - 18} padLeft={padLeft} />

            {days.map((day, index) => {
              const plotHeight = CHART_HEIGHT - 18;
              const x = padLeft + slot * index + (slot - barWidth) / 2;
              const activeHeight = (day.active / max) * plotHeight;
              const cancelledHeight = (day.cancelled / max) * plotHeight;
              // 2px of surface between the two segments, so they stay
              // countable instead of merging into one block.
              const gap = activeHeight > 0 && cancelledHeight > 0 ? 2 : 0;
              const cancelledY = plotHeight - cancelledHeight;
              const activeY = cancelledY - gap - activeHeight;

              return (
                <g
                  key={day.date}
                  onMouseEnter={() => setHover({ ...day, index })}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* An invisible full-height target: the hit area must be
                      bigger than the mark, or a 1-trip bar is unhoverable. */}
                  <rect
                    x={padLeft + slot * index}
                    y={0}
                    width={slot}
                    height={plotHeight}
                    fill="transparent"
                  />
                  <path
                    d={barPath(x, activeY, barWidth, activeHeight, true)}
                    fill="var(--series-1)"
                    opacity={hover && hover.index !== index ? 0.45 : 1}
                  />
                  <path
                    d={barPath(x, cancelledY, barWidth, cancelledHeight, activeHeight === 0)}
                    fill="var(--series-2)"
                    opacity={hover && hover.index !== index ? 0.45 : 1}
                  />
                  {/* Every other label, so they never collide. */}
                  {index % 2 === 0 && (
                    <text
                      x={padLeft + slot * index + slot / 2}
                      y={CHART_HEIGHT - 4}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="11"
                    >
                      {day.short}
                    </text>
                  )}
                </g>
              );
            })}
            <line
              x1={padLeft}
              y1={CHART_HEIGHT - 18}
              x2={width}
              y2={CHART_HEIGHT - 18}
              stroke="#383835"
            />
          </svg>

          {hover && (
            <div
              className="tooltip"
              style={{
                left: `${((padLeft + slot * hover.index + slot / 2) / width) * 100}%`,
                top: 0,
                transform: 'translate(-50%, -8px)',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{hover.label}</div>
              <div>Running: {hover.active}</div>
              <div>Cancelled: {hover.cancelled}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Stops on each route — one series, so no legend: the heading names it.
 * Horizontal, because route names are words and would have to be turned on
 * their side under a vertical bar.
 */
export function StopsByRouteChart({ routes }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...routes.map((route) => route.stop_count));

  if (routes.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No routes yet.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {routes.map((route) => (
        <div
          key={route.id}
          onMouseEnter={() => setHover(route.id)}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'grid', gridTemplateColumns: '58px 1fr 28px', alignItems: 'center', gap: 10 }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{route.code}</span>
          <div
            style={{
              height: 10,
              background: 'var(--surface-3)',
              borderRadius: 5,
              overflow: 'hidden',
            }}
            title={`${route.name}: ${route.stop_count} stops`}
          >
            <div
              style={{
                width: `${(route.stop_count / max) * 100}%`,
                height: '100%',
                background: 'var(--series-1)',
                borderRadius: 5,
                opacity: hover && hover !== route.id ? 0.45 : 1,
                transition: 'opacity .12s',
              }}
            />
          </div>
          {/* The value is direct-labelled here because there are few rows and
              it removes the need to read against an axis at all. */}
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {route.stop_count}
          </span>
        </div>
      ))}
    </div>
  );
}
