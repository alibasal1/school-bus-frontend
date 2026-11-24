// Dashboard. Owner: Yehia.
//
// The overview the app opens on. Everything comes from the Route & Stop API,
// from endpoints any logged-in role may call, so a parent and an admin both
// get a useful first screen.
//
// The numbers are counted from the same two requests the charts already
// need, rather than from a dedicated stats endpoint: three routes and a
// fortnight of trips is a small amount of data, and a stats endpoint that
// disagrees with the chart beside it is worse than no stats endpoint.
//
// React styles only, using the shared tokens, so this page matches Ali's.

import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { StopsByRouteChart, TripsByDayChart } from './routes/Charts';
import {
  Badge,
  Btn,
  ErrorBanner,
  Spinner,
  addDaysIso,
  formatIsoDate,
  styles,
  todayIso,
  tokens,
} from './routes/ui';

const WINDOW_DAYS = 14;

export default function DashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!cancelled) {
          setError(Object.assign(new Error('Please log in to see the dashboard.'), { status: 401 }));
          setLoading(false);
        }
        return;
      }

      try {
        const from = todayIso();
        const to = addDaysIso(from, WINDOW_DAYS - 1);
        const [routes, trips] = await Promise.all([
          apiRequest('routes', '/api/routes?limit=100'),
          apiRequest('routes', `/api/trips?from=${from}&to=${to}&limit=200`),
        ]);
        if (!cancelled) {
          setData({ routes: routes.items, trips: trips.items, from, to });
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) setError(caught);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner>Loading the dashboard…</Spinner>;
  if (error) return <ErrorBanner error={error} />;

  const { routes, trips, from, to } = data;
  const days = buildDays(from, trips);
  const totalStops = routes.reduce((sum, route) => sum + Number(route.stop_count), 0);
  const active = trips.filter((trip) => trip.status === 'active').length;
  const cancelled = trips.filter((trip) => trip.status === 'cancelled').length;
  const routesWithoutStops = routes.filter((route) => Number(route.stop_count) === 0).length;

  const cancellations = trips
    .filter((trip) => trip.status === 'cancelled')
    .sort((a, b) => a.service_date.localeCompare(b.service_date))
    .slice(0, 6);

  return (
    <section>
      <h2 style={styles.pageTitle}>Dashboard</h2>

      {/* The one number the page is about, with its context beside it rather
          than as a second tile. */}
      <div style={styles.card}>
        <p style={{ ...styles.muted, margin: 0 }}>
          Runs scheduled over the next {WINDOW_DAYS} days
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 40, fontWeight: 700, margin: '4px 0 0', color: tokens.text }}>
            {active}
          </p>
          {cancelled > 0 && <Badge tone="bad">{cancelled} cancelled</Badge>}
          {cancelled === 0 && trips.length > 0 && <Badge tone="good">None cancelled</Badge>}
        </div>
        <p style={{ ...styles.muted, marginTop: 6 }}>
          {formatIsoDate(from)} to {formatIsoDate(to)}
        </p>
        <div style={{ ...styles.row, marginTop: 14 }}>
          <Btn primary onClick={() => onNavigate('routes')}>
            Manage routes
          </Btn>
          <Btn onClick={() => onNavigate('favorites')}>My stops</Btn>
          <Btn onClick={() => onNavigate('alerts')}>Alerts</Btn>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        }}
      >
        <StatTile label="Routes" value={routes.length} note={`${totalStops} stops in total`} />
        <StatTile
          label="Average stops per route"
          value={routes.length ? (totalStops / routes.length).toFixed(1) : '0'}
          note={
            routesWithoutStops > 0
              ? `${routesWithoutStops} route${routesWithoutStops === 1 ? '' : 's'} with no stops`
              : 'Every route has stops'
          }
          warn={routesWithoutStops > 0}
        />
        <StatTile
          label="Cancellation rate"
          value={trips.length ? `${Math.round((cancelled / trips.length) * 100)}%` : '—'}
          note={`${cancelled} of ${trips.length} runs`}
        />
      </div>

      <div style={{ ...styles.card, marginTop: 14 }}>
        <TripsByDayChart days={days} />
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Stops on each route</h3>
        <StopsByRouteChart routes={routes.slice(0, 8)} />
      </div>

      <div style={styles.card}>
        <div style={{ ...styles.row, marginBottom: 10 }}>
          <h3 style={{ ...styles.cardTitle, flex: 1, margin: 0 }}>Cancellations ahead</h3>
          <Btn onClick={() => onNavigate('routes')}>All trips</Btn>
        </div>
        {cancellations.length === 0 ? (
          <p style={{ ...styles.muted, margin: 0 }}>
            No cancellations in the next {WINDOW_DAYS} days.
          </p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Day</th>
                <th style={styles.th}>Route</th>
                <th style={styles.th}>Run</th>
                <th style={styles.th}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.map((trip) => (
                <tr key={trip.id}>
                  <td style={styles.td}>{formatIsoDate(trip.service_date)}</td>
                  <td style={styles.td}>{trip.route_code}</td>
                  <td style={styles.td}>{trip.run_type}</td>
                  <td style={{ ...styles.td, color: tokens.grey }}>
                    {trip.cancellation_reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function StatTile({ label, value, note, warn }) {
  return (
    <div
      style={{
        ...styles.card,
        marginBottom: 0,
        // A route with no stops cannot have a trip, so it is worth a warning
        // colour. The words say it too; the colour is never the only cue.
        ...(warn ? { background: tokens.warnBg, borderColor: tokens.warnBorder } : null),
      }}
    >
      <p style={{ ...styles.muted, margin: 0, color: warn ? tokens.warnText : tokens.grey }}>
        {label}
      </p>
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          margin: '4px 0 0',
          color: warn ? tokens.warnText : tokens.text,
        }}
      >
        {value}
      </p>
      {note && (
        <p style={{ ...styles.muted, marginTop: 6, color: warn ? tokens.warnText : tokens.grey }}>
          {note}
        </p>
      )}
    </div>
  );
}

/** One entry per day in the window, so a day with no trips still shows up. */
function buildDays(from, trips) {
  const byDate = new Map();
  for (const trip of trips) {
    if (!byDate.has(trip.service_date)) byDate.set(trip.service_date, { active: 0, cancelled: 0 });
    const bucket = byDate.get(trip.service_date);
    if (trip.status === 'cancelled') bucket.cancelled += 1;
    else bucket.active += 1;
  }

  return Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const date = addDaysIso(from, index);
    const counts = byDate.get(date) || { active: 0, cancelled: 0 };
    return {
      date,
      label: formatIsoDate(date),
      short: date.slice(8), // day of the month
      ...counts,
    };
  });
}
