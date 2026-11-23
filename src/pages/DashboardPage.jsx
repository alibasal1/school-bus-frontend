// Dashboard. Owner: Yehia.
//
// The overview the app opens on. Everything here comes from the Route & Stop
// API and from endpoints any logged-in role may call, so a parent and an
// admin both get a useful first screen.
//
// The numbers are counted from the same two requests the page already needs
// for its charts, rather than from a dedicated stats endpoint: three routes
// and a fortnight of trips is a small amount of data, and a stats endpoint
// that disagrees with the chart beside it is worse than no stats endpoint.

import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { StopsByRouteChart, TripsByDayChart } from './routes/Charts';
import { ErrorBanner, Spinner, addDaysIso, formatIsoDate, todayIso } from './routes/ui';

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
          setError(
            Object.assign(new Error('Please log in to see the dashboard.'), { status: 401 })
          );
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
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Hero: the one number the page is about, with its context beside it
          rather than as a second tile. */}
      <section className="panel">
        <p className="stat-label">Runs scheduled over the next {WINDOW_DAYS} days</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <p className="hero-value">{active}</p>
          {cancelled > 0 && (
            <span className="delta delta-bad">✕ {cancelled} cancelled</span>
          )}
          {cancelled === 0 && trips.length > 0 && (
            <span className="delta delta-good">✓ none cancelled</span>
          )}
        </div>
        <p className="stat-label" style={{ marginTop: 6 }}>
          {formatIsoDate(from)} — {formatIsoDate(to)}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn-accent" onClick={() => onNavigate('routes')}>
            Manage routes
          </button>
          <button type="button" onClick={() => onNavigate('favorites')}>
            My stops
          </button>
          <button type="button" onClick={() => onNavigate('alerts')}>
            Alerts
          </button>
        </div>
      </section>

      <section className="grid grid-3">
        <StatTile label="Routes" value={routes.length} note={`${totalStops} stops in total`} />
        <StatTile
          label="Average stops per route"
          value={routes.length ? (totalStops / routes.length).toFixed(1) : '0'}
          note={
            routesWithoutStops > 0
              ? `⚠ ${routesWithoutStops} route${routesWithoutStops === 1 ? '' : 's'} with no stops`
              : 'every route has stops'
          }
          noteTone={routesWithoutStops > 0 ? 'warning' : undefined}
        />
        <StatTile
          label="Cancellation rate"
          value={trips.length ? `${Math.round((cancelled / trips.length) * 100)}%` : '—'}
          note={`${cancelled} of ${trips.length} runs`}
        />
      </section>

      <section className="grid grid-main">
        <div className="panel">
          <TripsByDayChart days={days} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Stops on each route</h3>
          </div>
          <StopsByRouteChart routes={routes.slice(0, 8)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Cancellations ahead</h3>
          <button type="button" onClick={() => onNavigate('routes')}>
            All trips
          </button>
        </div>
        {cancellations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            No cancellations in the next {WINDOW_DAYS} days.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Route</th>
                <th>Run</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.map((trip) => (
                <tr key={trip.id}>
                  <td>{formatIsoDate(trip.service_date)}</td>
                  <td>{trip.route_code}</td>
                  <td>{trip.run_type}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {trip.cancellation_reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value, note, noteTone }) {
  return (
    <div className="panel">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {note && (
        <p
          className="stat-label"
          style={{ marginTop: 6, color: noteTone === 'warning' ? 'var(--warning)' : undefined }}
        >
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
