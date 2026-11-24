// Charts for the dashboard. Owner: Yehia.
//
// Hand-drawn SVG, React styles only. A charting library would be a new
// dependency for everyone on the team and a bigger bundle, for two charts.
//
// Choices that are not cosmetic:
//  * The two series colours were validated against a white card, not picked
//    by eye: lightness band, chroma floor, colour-blind separation (ΔE 24.7
//    protan), normal-vision separation (ΔE 33.6) and >=3:1 contrast all pass.
//  * Neither is Ali's navy, so a bar can never be mistaken for a button.
//  * Two series means a legend is always shown, and there is a table toggle,
//    so meaning never rests on colour alone. That also covers print and
//    forced-colours mode.
//  * One vertical scale. Never two y-axes.
//  * Bars sit on the baseline, rounded at the top only, with a 2px gap
//    between stacked segments so they stay countable when values are small.

import { useState } from 'react';
import { Btn, series, styles, tokens } from './ui';

const CHART_HEIGHT = 190;
// A real coordinate space, scaled uniformly by the browser. A narrow viewBox
// with preserveAspectRatio="none" would scale x and y separately: the labels
// come out squashed and the 4px corners turn into ellipses.
const CHART_WIDTH = 720;
const BAR_RADIUS = 4;
const AXIS_BAND = 18;

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
            <line x1={padLeft} y1={y} x2={width} y2={y} stroke={tokens.border} strokeWidth="1" />
            <text x={padLeft - 8} y={y + 4} textAnchor="end" fill={tokens.grey} fontSize="11">
              {Math.round(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function LegendKey({ colour, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: colour }} />
      {children}
    </span>
  );
}

/**
 * Trips per day, split into running and cancelled.
 *
 * Stacked rather than side by side because the question is "how many runs
 * that day, and how many fell through" - the total matters as much as the
 * split.
 */
export function TripsByDayChart({ days }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const max = Math.max(1, ...days.map((day) => day.active + day.cancelled));
  const padLeft = 30;
  const width = CHART_WIDTH;
  const slot = (width - padLeft) / Math.max(days.length, 1);
  const barWidth = Math.min(slot * 0.5, 26);
  const plotHeight = CHART_HEIGHT - AXIS_BAND;

  return (
    <div>
      <div style={{ ...styles.row, marginBottom: 10 }}>
        <h3 style={{ ...styles.cardTitle, flex: 1, margin: 0 }}>Bus days ahead</h3>
        <span style={{ display: 'flex', gap: 14, fontSize: 14, color: tokens.grey }}>
          <LegendKey colour={series.one}>Running</LegendKey>
          <LegendKey colour={series.two}>Cancelled</LegendKey>
        </span>
        <Btn onClick={() => setShowTable((value) => !value)}>{showTable ? 'Chart' : 'Table'}</Btn>
      </div>

      {showTable ? (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Day</th>
              <th style={styles.th}>Running</th>
              <th style={styles.th}>Cancelled</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td style={styles.td}>{day.label}</td>
                <td style={styles.td}>{day.active}</td>
                <td style={styles.td}>{day.cancelled}</td>
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
            <Gridlines max={max} width={width} height={plotHeight} padLeft={padLeft} />

            {days.map((day, index) => {
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
                      bigger than the mark, or a one-trip bar is unhoverable. */}
                  <rect
                    x={padLeft + slot * index}
                    y={0}
                    width={slot}
                    height={plotHeight}
                    fill="transparent"
                  />
                  <path
                    d={barPath(x, activeY, barWidth, activeHeight, true)}
                    fill={series.one}
                    opacity={hover && hover.index !== index ? 0.45 : 1}
                  />
                  <path
                    d={barPath(x, cancelledY, barWidth, cancelledHeight, activeHeight === 0)}
                    fill={series.two}
                    opacity={hover && hover.index !== index ? 0.45 : 1}
                  />
                  {/* Every other label, so they never collide. */}
                  {index % 2 === 0 && (
                    <text
                      x={padLeft + slot * index + slot / 2}
                      y={CHART_HEIGHT - 4}
                      textAnchor="middle"
                      fill={tokens.grey}
                      fontSize="11"
                    >
                      {day.short}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={padLeft} y1={plotHeight} x2={width} y2={plotHeight} stroke={tokens.grey} />
          </svg>

          {hover && (
            <div
              style={{
                position: 'absolute',
                left: `${((padLeft + slot * hover.index + slot / 2) / width) * 100}%`,
                top: 0,
                transform: 'translate(-50%, -8px)',
                pointerEvents: 'none',
                background: '#fff',
                border: `1px solid ${tokens.border}`,
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 14,
                color: tokens.text,
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 18px rgba(31, 37, 51, 0.12)',
                zIndex: 2,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{hover.label}</div>
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
 * Stops on each route - one series, so no legend: the heading names it.
 * Horizontal, because route names are words and would have to be turned on
 * their side under a vertical bar. The value is direct-labelled, so there is
 * no axis to read against at all.
 */
export function StopsByRouteChart({ routes }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...routes.map((route) => route.stop_count));

  if (routes.length === 0) {
    return <p style={styles.muted}>No routes yet.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {routes.map((route) => (
        <div
          key={route.id}
          onMouseEnter={() => setHover(route.id)}
          onMouseLeave={() => setHover(null)}
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 30px',
            alignItems: 'center',
            gap: 10,
          }}
          title={`${route.name}: ${route.stop_count} stops`}
        >
          <span style={{ fontSize: 14, color: tokens.grey }}>{route.code}</span>
          <div style={{ height: 10, background: '#eef1f6', borderRadius: 5, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(route.stop_count / max) * 100}%`,
                height: '100%',
                background: series.one,
                borderRadius: 5,
                opacity: hover && hover !== route.id ? 0.45 : 1,
                transition: 'opacity .12s',
              }}
            />
          </div>
          <span style={{ fontSize: 14, color: tokens.grey, textAlign: 'right' }}>
            {route.stop_count}
          </span>
        </div>
      ))}
    </div>
  );
}
