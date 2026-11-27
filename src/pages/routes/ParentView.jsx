// What a parent, student or supervisor sees. Owner: Yehia (247330).
//
// Read only: find a route, see its stops in order, and see whether its
// runs are going ahead. Every endpoint here is open to any signed-in role.
// The admin controls are in AdminView, and the API refuses them with 403
// for anyone else, so hiding them is a convenience and not the control.

import { useCallback, useEffect, useRef, useState } from 'react';
import { routesApi } from './routesApi';
import { Badge, Btn, Card, Empty, ErrorBanner, Field, Spinner, Table, styles } from './ui';

export default function ParentView() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  // The box fires on every keystroke, so the request waits until typing
  // stops. Without this, "Maadi" is five requests, four of them wasted,
  // and five is enough to meet the rate limit while typing one word.
  const term = useDebounced(search, 350);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '10' });
      if (term.trim()) query.set('search', term.trim());
      setResults(await routesApi(`/api/routes?${query}`));
      setError(null);
    } catch (caught) {
      setError(caught);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [term, page]);

  useEffect(() => {
    load();
  }, [load]);

  // A new search term makes the old page number meaningless.
  useEffect(() => {
    setPage(1);
  }, [term]);

  return (
    <div style={styles.stack}>
      <Card title="Find a route">
        <Field label="Search" hint="By code, name or area, for example R1 or Maadi.">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="R1, Maadi, Nasr City"
            maxLength={100}
            aria-label="Find a route"
          />
        </Field>
      </Card>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading && <Spinner>Looking for routes...</Spinner>}

      {!loading && results && results.items.length === 0 && (
        <Empty>
          {search.trim() ? `No route matches "${search.trim()}".` : 'There are no routes yet.'}
        </Empty>
      )}

      {!loading &&
        results?.items.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            open={route.id === openId}
            onToggle={() => setOpenId(route.id === openId ? null : route.id)}
          />
        ))}

      {results && results.pages > 1 && (
        <div style={styles.row}>
          <Btn onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>
            Previous
          </Btn>
          <span className="muted">
            Page {results.page} of {results.pages}, {results.total} route
            {results.total === 1 ? '' : 's'}
          </span>
          <Btn onClick={() => setPage((value) => value + 1)} disabled={page >= results.pages}>
            Next
          </Btn>
        </div>
      )}
    </div>
  );
}

/**
 * One route. The stops and the runs are only fetched when the card is
 * opened: loading them for every result would be ten extra requests for a
 * list the parent is still scanning.
 */
function RouteCard({ route, open, onToggle }) {
  const [detail, setDetail] = useState(null);
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || detail) return undefined;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [routeDetail, tripList] = await Promise.all([
          routesApi(`/api/routes/${route.id}`),
          routesApi(`/api/trips?route_id=${encodeURIComponent(route.id)}&limit=20`),
        ]);
        if (cancelled) return;
        setDetail(routeDetail);
        setTrips(tripList.items);
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(caught);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Closing the card, or leaving the page, while the request is in
    // flight would otherwise set state on a component nobody is looking at.
    return () => {
      cancelled = true;
    };
  }, [open, detail, route.id]);

  return (
    <Card
      title={`${route.code} — ${route.name}`}
      actions={<Btn onClick={onToggle}>{open ? 'Hide' : 'Details'}</Btn>}
    >
      <div style={styles.tight}>
        <Badge>{route.area}</Badge>
        <Badge tone={route.stop_count > 0 ? 'neutral' : 'warn'}>
          {route.stop_count} stop{route.stop_count === 1 ? '' : 's'}
        </Badge>
        {route.is_active === false && <Badge tone="bad">Not running</Badge>}
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {loading && <Spinner>Loading stops and bus runs...</Spinner>}

          {detail && (
            <>
              <h4 className="section-title">Stops, in order</h4>
              {detail.stops.length === 0 ? (
                <Empty>No stops have been added to this route yet.</Empty>
              ) : (
                <ol className="row-list">
                  {detail.stops.map((stop) => (
                    <li key={stop.id}>
                      {stop.name}
                      {stop.landmark && <span className="muted"> — {stop.landmark}</span>}
                    </li>
                  ))}
                </ol>
              )}

              <h4 className="section-title">Bus runs</h4>
              <TripList trips={trips} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * A cancelled run shows its reason rather than being hidden. "No bus
 * tomorrow, the bus is in for repair" is the single most useful thing this
 * page can tell a parent, and hiding it would look exactly like a run that
 * never existed.
 */
function TripList({ trips }) {
  if (!trips) return null;
  if (trips.length === 0) return <Empty>No runs are set up for this route yet.</Empty>;

  return (
    <Table head={['Run', 'Status', 'Bus']}>
      {trips.map((trip) => (
        <tr key={trip.id}>
          <td>{trip.run_type}</td>
          <td>
            {trip.status === 'cancelled' ? (
              <>
                <Badge tone="bad">Cancelled</Badge>
                <div className="muted">
                  {trip.cancelled_date ? `On ${trip.cancelled_date}. ` : ''}
                  {trip.cancellation_reason || ''}
                </div>
              </>
            ) : (
              <Badge tone="good">Running</Badge>
            )}
          </td>
          <td className="muted">{trip.bus_id ? trip.bus_id : 'not assigned'}</td>
        </tr>
      ))}
    </Table>
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
