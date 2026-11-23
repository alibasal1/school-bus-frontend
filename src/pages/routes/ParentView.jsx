// What a parent, student or supervisor sees. Owner: Yehia.
//
// Read-only: find a route, see its stops in order, and see whether the bus is
// running over the next week. Every endpoint used here is open to any
// logged-in role; the admin controls live in AdminView and are refused by the
// API with 403 for anyone else, not merely hidden.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import {
  Badge,
  Empty,
  ErrorBanner,
  Field,
  Spinner,
  addDaysIso,
  formatIsoDate,
  styles,
  todayIso,
} from './ui';

const LOOKAHEAD_DAYS = 7;

export default function ParentView() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [page, setPage] = useState(1);
  const [listError, setListError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // The search box fires on every keystroke, so the request is delayed until
  // typing stops. Without this, "Maadi" is five requests, four of them
  // wasted, and five is enough to walk into the API's rate limit while
  // typing a single word.
  const debounced = useDebounced(search, 350);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '10' });
      if (debounced.trim()) query.set('search', debounced.trim());
      setResults(await apiRequest('routes', `/api/routes?${query}`));
      setListError(null);
    } catch (error) {
      setListError(error);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [debounced, page]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // A new search term means the old page number is meaningless.
  useEffect(() => {
    setPage(1);
  }, [debounced]);

  return (
    <section>
      <Field label="Find a route" hint="Search by code, name or area — for example R-01 or Maadi.">
        <input
          style={{ ...styles.input, maxWidth: 320 }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="R-01, Maadi, Nasr City…"
          maxLength={100}
          aria-label="Find a route"
        />
      </Field>

      <ErrorBanner error={listError} onDismiss={() => setListError(null)} />

      {loading && <Spinner>Looking for routes…</Spinner>}

      {!loading && results && results.items.length === 0 && (
        <Empty>
          {search.trim()
            ? `No route matches “${search.trim()}”.`
            : 'There are no routes yet.'}
        </Empty>
      )}

      {!loading &&
        results?.items.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            expanded={route.id === selectedId}
            onToggle={() => setSelectedId(route.id === selectedId ? null : route.id)}
          />
        ))}

      {results && results.pages > 1 && (
        <div style={styles.row}>
          <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            Previous
          </button>
          <span style={styles.muted}>
            Page {results.page} of {results.pages} · {results.total} route
            {results.total === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= results.pages}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * One route in the list. The stops and the week's trips are only fetched when
 * the card is opened: loading them for every result would be ten extra
 * requests for a list the parent is still scanning.
 */
function RouteCard({ route, expanded, onToggle }) {
  const [detail, setDetail] = useState(null);
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || detail) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const from = todayIso();
        const to = addDaysIso(from, LOOKAHEAD_DAYS - 1);
        const tripQuery = new URLSearchParams({
          route_id: route.id,
          from,
          to,
          limit: '50',
        });

        const [routeDetail, tripList] = await Promise.all([
          apiRequest('routes', `/api/routes/${route.id}`),
          apiRequest('routes', `/api/trips?${tripQuery}`),
        ]);

        if (cancelled) return;
        setDetail(routeDetail);
        setTrips(tripList.items);
        setError(null);
      } catch (loadError) {
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Closing the card, or leaving the page, while the request is in flight
    // would otherwise set state on a component nobody is looking at.
    return () => {
      cancelled = true;
    };
  }, [expanded, detail, route.id]);

  return (
    <article style={styles.card}>
      <div style={styles.row}>
        <strong>{route.code}</strong>
        <span style={{ flex: 1 }}>{route.name}</span>
        <Badge>{route.area}</Badge>
        <Badge tone={route.stop_count > 0 ? 'neutral' : 'warn'}>
          {route.stop_count} stop{route.stop_count === 1 ? '' : 's'}
        </Badge>
        {route.is_active === false && <Badge tone="bad">Not running</Badge>}
        <button type="button" onClick={onToggle}>
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {loading && <Spinner>Loading stops and bus days…</Spinner>}

          {detail && (
            <>
              <h4 style={{ margin: '8px 0 4px' }}>Stops, in order</h4>
              {detail.stops.length === 0 ? (
                <Empty>No stops have been added to this route yet.</Empty>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {detail.stops.map((stop) => (
                    <li key={stop.id}>
                      {stop.name}
                      {stop.landmark && <span style={styles.muted}> — {stop.landmark}</span>}
                    </li>
                  ))}
                </ol>
              )}

              <h4 style={{ margin: '12px 0 4px' }}>Next {LOOKAHEAD_DAYS} days</h4>
              <TripWeek trips={trips} />
            </>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * The week's trips, grouped by day.
 *
 * A cancelled trip is shown with its reason rather than hidden: "no bus
 * tomorrow, the bus is in for repair" is the single most useful thing this
 * page can tell a parent, and hiding it would look identical to a day the
 * route never runs.
 */
function TripWeek({ trips }) {
  if (!trips) return null;
  if (trips.length === 0) {
    return <Empty>No bus days are scheduled for this route in the next week.</Empty>;
  }

  const byDate = new Map();
  for (const trip of trips) {
    if (!byDate.has(trip.service_date)) byDate.set(trip.service_date, []);
    byDate.get(trip.service_date).push(trip);
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Day</th>
          <th style={styles.th}>Runs</th>
        </tr>
      </thead>
      <tbody>
        {[...byDate.entries()].map(([date, dayTrips]) => (
          <tr key={date}>
            <td style={styles.td}>{formatIsoDate(date)}</td>
            <td style={styles.td}>
              {dayTrips.map((trip) => (
                <div key={trip.id} style={{ ...styles.row, marginBottom: 4 }}>
                  <Badge tone={trip.status === 'cancelled' ? 'bad' : 'good'}>
                    {trip.run_type}
                  </Badge>
                  {trip.status === 'cancelled' ? (
                    <span>
                      Cancelled
                      {trip.cancellation_reason && ` — ${trip.cancellation_reason}`}
                    </span>
                  ) : (
                    <span style={styles.muted}>
                      Running{trip.plate_number ? ` · bus ${trip.plate_number}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Returns `value` only once it has stopped changing for `delay` ms. */
function useDebounced(value, delay) {
  const [settled, setSettled] = useState(value);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer.current);
  }, [value, delay]);

  return settled;
}
