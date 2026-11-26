import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { apiRequest } from '../api';
import { getSession, clearSession } from '../auth';

const DEMO_ROUTES = [
  { id: 'demo-r1', code: 'N1', name: 'North Valley', area: 'North', _demo: true, stops: [
    { id: 'dn1-s1', name: 'Main Gate', stop_order: 1 }, { id: 'dn1-s2', name: 'Al Nozha St', stop_order: 2 }, { id: 'dn1-s3', name: 'Green Park', stop_order: 3 }, { id: 'dn1-s4', name: 'North School', stop_order: 4 },
  ] },
  { id: 'demo-r2', code: 'S2', name: 'South Bridge', area: 'South', _demo: true, stops: [
    { id: 'ds2-s1', name: 'City Centre', stop_order: 1 }, { id: 'ds2-s2', name: 'River Rd', stop_order: 2 }, { id: 'ds2-s3', name: 'Al Corniche', stop_order: 3 }, { id: 'ds2-s4', name: 'South Campus', stop_order: 4 },
  ] },
  { id: 'demo-r3', code: 'E3', name: 'East Express', area: 'East', _demo: true, stops: [
    { id: 'de3-s1', name: 'East Gate', stop_order: 1 }, { id: 'de3-s2', name: 'Industrial Zone', stop_order: 2 }, { id: 'de3-s3', name: 'Maadi Sq', stop_order: 3 },
  ] },
];

function rowsFrom(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

function windowMinutes(from, to) {
  if (!from || !to) return null;
  const [fromHours, fromMinutes] = from.split(':').map(Number);
  const [toHours, toMinutes] = to.split(':').map(Number);
  return Math.max(0, (toHours * 60 + toMinutes) - (fromHours * 60 + fromMinutes));
}

export default function SchedulePage() {
  const session = getSession();
  const [routes, setRoutes] = useState([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [tripId, setTripId] = useState('');
  const [eta, setEta] = useState(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const [etaError, setEtaError] = useState('');
  const listRef = useRef(null);

  async function selectRoute(route) {
    setSelectedRoute(route);
    setEta(null);
    setEtaError('');
    if (route._demo) {
      setStops(route.stops || []);
      setStopsLoading(false);
      return;
    }
    setStops([]);
    setStopsLoading(true);
    try {
      const data = await apiRequest(`/api/routes/${encodeURIComponent(route.id)}/stops`);
      setStops(rowsFrom(data).sort((a, b) => Number(a.stop_order) - Number(b.stop_order)));
    } catch (error) {
      setEtaError(error.message || 'Could not load the stops for this route.');
    } finally {
      setStopsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!session) {
      setRoutesLoading(false);
      return () => { active = false; };
    }
    apiRequest('/api/routes')
      .then((data) => {
        if (!active) return;
        const liveRoutes = rowsFrom(data);
        if (liveRoutes.length) {
          setRoutes(liveRoutes);
          setUsingDemo(false);
          setRoutesError('');
        } else {
          setRoutes(DEMO_ROUTES);
          setUsingDemo(true);
          setRoutesError('No routes are saved in the backend yet. Showing example routes.');
        }
      })
      .catch((error) => {
        if (!active) return;
        setRoutes(DEMO_ROUTES);
        setUsingDemo(true);
        setRoutesError(`${error.message || 'Could not connect to the backend.'} Showing example routes.`);
      })
      .finally(() => { if (active) setRoutesLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (routes.length && listRef.current) {
      gsap.fromTo(listRef.current.querySelectorAll('.route-card'),
        { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.32, stagger: 0.05, ease: 'power2.out' });
    }
  }, [routes]);

  const lookupEta = async (event) => {
    event.preventDefault();
    if (!tripId.trim()) return;
    setEtaLoading(true);
    setEtaError('');
    setEta(null);
    try {
      const data = await apiRequest(`/api/trips/${encodeURIComponent(tripId.trim())}/eta`);
      setEta(data);
    } catch (error) {
      setEtaError(error.message || 'Trip not found or arrival times are unavailable.');
    } finally {
      setEtaLoading(false);
    }
  };

  if (!session) {
    return (
      <section className="wrap" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <p className="hero-eyebrow">SCHOOL BUS ROUTE TRACKER</p>
        <h2 style={{ margin: '0 0 10px', fontSize: 24, color: 'var(--p-ink)' }}>Sign in to see routes and arrival times</h2>
        <p style={{ color: 'var(--p-muted)', fontSize: 14, marginBottom: 24 }}>Your route schedule and trip details are available after you sign in.</p>
        <a href="#/login" className="btn btn--primary">Sign in</a>
        <a href="#/signup" className="btn" style={{ marginLeft: 8 }}>Create account</a>
      </section>
    );
  }

  const etaForRoute = eta?.route_id === selectedRoute?.id;
  const etaByStopId = new Map((etaForRoute ? eta.stops || [] : []).map((item) => [item.stop_id, item]));

  return (
    <section className="wrap schedule-page" style={{ maxWidth: 1080, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 26 }}>
        <div>
          <p className="hero-eyebrow" style={{ marginBottom: 12 }}>SCHOOL BUS ROUTE TRACKER</p>
          <h2 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--p-ink)' }}>Routes &amp; schedule</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--p-muted)' }}>Signed in as <strong style={{ color: 'var(--p-ink)' }}>{session.displayName || session.user?.name}</strong> <span className="badge badge--accent">{session.role}</span></p>
        </div>
        <button onClick={async () => { try { await apiRequest('/api/sessions/current', { method: 'DELETE' }); } finally { clearSession(); window.location.hash = '#/login'; } }} className="btn btn--sm">Sign out</button>
      </div>

      {usingDemo && <div className="banner banner--error" role="status" style={{ background: 'rgba(242,184,75,0.08)', borderColor: 'rgba(242,184,75,0.35)', color: 'var(--p-warn)' }}>{routesError}</div>}

      <div className="schedule-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 310px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        <aside aria-label="Available routes">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-ink)' }}>Routes</h3>
            <span className="badge">{routesLoading ? 'Loading' : routes.length}</span>
          </div>
          <div ref={listRef} className="schedule-route-list">
            {routes.map((route) => {
              const active = selectedRoute?.id === route.id;
              const count = route.stops?.length ?? route.stop_count;
              return (
                <button key={route.id} type="button" className={`route-card${active ? ' is-selected' : ''}`} aria-pressed={active} onClick={() => selectRoute(route)}>
                  <span className="route-card__code">{route.code || 'ROUTE'}</span>
                  <span className="route-card__name">{route.name || 'Unnamed route'}</span>
                  <span className="route-card__meta">{route.area || 'Area not set'}{count != null ? ` · ${count} stops` : ''}</span>
                  <span className="route-card__action">{active ? 'Selected' : 'View route →'}</span>
                </button>
              );
            })}
            {!routesLoading && routes.length === 0 && <div className="card muted">No routes are available.</div>}
            {routesLoading && <div className="card muted">Loading routes…</div>}
          </div>
        </aside>

        <div className="schedule-details">
          {!selectedRoute ? (
            <div className="card schedule-empty"><span className="schedule-empty__index">ROUTE SCHEDULE</span><h3>Choose a route</h3><p>Route stops and scheduled arrival windows will appear here.</p></div>
          ) : (
            <>
              <section className="card" style={{ marginBottom: 18 }}>
                <div className="card__head">
                  <div><span className="schedule-empty__index">{selectedRoute.code} · {selectedRoute.area}</span><h3 className="card__title" style={{ marginTop: 6 }}>{selectedRoute.name}</h3></div>
                  <span className="badge badge--accent">{stops.length} stops</span>
                </div>
                {stopsLoading && <p className="muted">Loading route stops…</p>}
                {!stopsLoading && stops.length === 0 && <p className="muted">No stops have been added to this route.</p>}
                {stops.length > 0 && (
                  <div className="stop-timeline">
                    <div className="stop-timeline__track" />
                    {stops.map((stop, index) => {
                      const planned = etaByStopId.get(stop.id);
                      return <div key={stop.id} className="stop-node">
                        <div><div style={{ fontWeight: 600, fontSize: 14, color: 'var(--p-ink)' }}>{stop.name}</div><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Stop {String(index + 1).padStart(2, '0')}</div></div>
                        <div className="schedule-arrival">
                          {planned?.arrive_from && planned?.arrive_to ? <><strong>{planned.arrive_from} – {planned.arrive_to}</strong><span>{windowMinutes(planned.arrive_from, planned.arrive_to)} minute arrival window</span></> : <span>{etaForRoute ? 'Arrival time not set' : 'Load a trip ETA to see times'}</span>}
                        </div>
                      </div>;
                    })}
                  </div>
                )}
              </section>

              {!usingDemo && <section className="card">
                <div className="card__head"><div><span className="schedule-empty__index">PLANNED TIMES</span><h3 className="card__title" style={{ marginTop: 6 }}>Trip arrival details</h3></div></div>
                <p className="card__desc">Enter a trip ID to see its planned arrival window at every stop on the route.</p>
                <form onSubmit={lookupEta} className="schedule-trip-form">
                  <label className="field" style={{ flex: 1 }}><span className="field__label">Trip ID</span><input className="input mono" type="text" value={tripId} onChange={(event) => setTripId(event.target.value)} placeholder="Enter trip ID" required /></label>
                  <button type="submit" disabled={etaLoading} className="btn btn--primary">{etaLoading ? 'Loading…' : 'Show arrival times'}</button>
                </form>
                {etaError && <div className="banner banner--error" role="alert" style={{ marginTop: 14 }}>{etaError}</div>}
                {eta && <div className="schedule-trip-result">
                  <div className="schedule-trip-summary"><div><span className="schedule-empty__index">TRIP</span><strong>{eta.trip_id}</strong></div><span className={`badge ${eta.status === 'cancelled' ? 'badge--danger' : 'badge--accent'}`}>{eta.status || 'scheduled'}</span>{eta.run_type && <span className="badge">{eta.run_type}</span>}{eta.service_date && <span className="badge">{eta.service_date}</span>}</div>
                  {eta.route_id !== selectedRoute.id && <p className="banner banner--error" role="status">This trip is assigned to another route. Select that route to compare its stop times.</p>}
                  {etaForRoute && (eta.stops || []).length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Stop</th><th>Arrival from</th><th>Arrival to</th><th>Window</th></tr></thead><tbody>{eta.stops.map((stop, index) => <tr key={stop.stop_id}><td className="muted mono">{index + 1}</td><td style={{ color: 'var(--p-ink)' }}>{stop.name || stop.stop_id}</td><td className="mono" style={{ color: 'var(--p-accent)' }}>{stop.arrive_from || '—'}</td><td className="mono" style={{ color: 'var(--p-accent)' }}>{stop.arrive_to || '—'}</td><td className="muted">{windowMinutes(stop.arrive_from, stop.arrive_to) ?? '—'}{stop.arrive_from && stop.arrive_to ? ' min' : ''}</td></tr>)}</tbody></table></div> : etaForRoute && <p className="muted">No arrival windows have been set for this trip.</p>}
                </div>}
              </section>}
              {usingDemo && <div className="card muted">Live trip times appear when the backend is running and the route data is loaded.</div>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
