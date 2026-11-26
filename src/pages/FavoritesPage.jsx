import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { getSession } from '../auth';

// My service has its own API address (VITE_FAVORITES_API_URL). The shared
// api.js only knows Ahmed's gateway, which has no /api/favorites routes, so
// this page calls my API directly with the same signed-in session token.
// Sessions live in the shared Sessions table, so my API accepts the token.
// Without the variable the page falls back to the shared apiRequest.
const MY_API = (import.meta.env.VITE_FAVORITES_API_URL || '').replace(/\/$/, '');

async function myApi(path, { method = 'GET', body } = {}) {
  if (!MY_API) return apiRequest('favorites', path, { method, body });
  const session = getSession();
  if (!session) {
    throw Object.assign(new Error('Sign in with your email and password to continue.'), { status: 401 });
  }
  const res = await fetch(`${MY_API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.token}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(data?.error?.message || `Request failed (${res.status}).`), {
      status: res.status,
      code: data?.error?.code
    });
  }
  return data;
}

// "2027-01-07" -> "Thu 7 Jan 2027". The date is read as UTC so the day
// never shifts with the browser's time zone.
function holidayDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  const part = (options) => date.toLocaleDateString('en-GB', { timeZone: 'UTC', ...options });
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })} ${part({ year: 'numeric' })}`;
}

// My stops page. Owner: Ali (246090).
// Everything on this page comes from my own service, including the routes and
// stops for the form (GET /api/favorites/options). That way the page still
// works when the Route & Stop API is down, and the parent calls one address.
// The look comes from the shared theme (src/styles/theme.css), like Ahmed's pages.
export default function FavoritesPage() {
  const session = getSession();
  const [favorites, setFavorites] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // One place for the confirmation line, so it always clears itself.
  function confirm(text) {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  }

  async function loadFavorites() {
    try {
      const data = await myApi('/api/favorites');
      setFavorites(data.favorites);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    try {
      const data = await myApi('/api/favorites/options');
      setRoutes(data.routes || []);
    } catch (err) {
      // The saved list still works without the form, so this is not a page error.
      setFormError(`Routes could not be loaded: ${err.message}`);
    }
  }

  // The API answers one year at a time. After the last holiday of the year
  // (October in Egypt) this year's list has nothing left, so the box stayed
  // empty until January. When fewer than 3 are left, next year's list is added.
  async function loadHolidays() {
    try {
      // Today in Cairo, the same date the API uses, as YYYY-MM-DD.
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      const year = Number(today.slice(0, 4));
      const upcoming = (list) => (list || []).filter((holiday) => holiday.date >= today);

      const data = await myApi(`/api/holidays?year=${year}`);
      let next = upcoming(data.holidays);
      if (next.length < 3) {
        const following = await myApi(`/api/holidays?year=${year + 1}`);
        next = next.concat(upcoming(following.holidays));
      }
      next = next
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3);
      setHolidays(next);
    } catch {
      // A missing holidays box is not worth an error message on the page.
      setHolidays([]);
    }
  }

  useEffect(() => {
    // No session: the Sign in block is shown and nothing is asked from the API.
    if (!session) {
      setLoading(false);
      return;
    }
    loadFavorites();
    loadOptions();
    loadHolidays();
  }, []);

  const selectedRoute = routes.find((route) => route.id === routeId);
  const stops = selectedRoute ? selectedRoute.stops : [];

  function onRouteChange(value) {
    setRouteId(value);
    setStopId('');
    setFormError('');
  }

  async function saveFavorite(event) {
    event.preventDefault();
    // A new try clears the last "Stop saved.", or a duplicate would show
    // the success line and the error at the same time.
    setMessage('');
    if (!routeId) {
      setFormError('Please choose a route first.');
      return;
    }
    setSaving(true);
    try {
      await myApi('/api/favorites', {
        method: 'POST',
        body: { routeId, stopId: stopId || null }
      });
      setFormError('');
      setRouteId('');
      setStopId('');
      await loadFavorites();
      confirm('Stop saved.');
    } catch (err) {
      // 409 means this parent saved the same route and stop already.
      setFormError(err.status === 409 ? 'You have already saved this stop.' : err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeFavorite(id) {
    try {
      await myApi(`/api/favorites/${id}`, { method: 'DELETE' });
      setFavorites((current) => current.filter((favorite) => favorite.id !== id));
      setError('');
      confirm('Stop removed.');
    } catch (err) {
      setError(err.message);
    }
  }

  // The next bus line and its badge. noBusToday is only true on a public holiday.
  function arrival(favorite) {
    if (favorite.noBusToday) {
      return { time: null, text: 'No bus today (public holiday)', badge: <span className="badge badge--warn">Holiday</span> };
    }
    if (favorite.tripStatus === 'cancelled') {
      return { time: null, text: "Today's trip is cancelled", badge: <span className="badge badge--danger">Cancelled</span> };
    }
    if (!favorite.arrivalFrom) {
      return { time: null, text: 'No upcoming bus time today', badge: null };
    }
    return {
      time: `${favorite.arrivalFrom.slice(0, 5)} - ${favorite.arrivalTo.slice(0, 5)}`,
      text: 'Next bus',
      badge: <span className="badge badge--accent">{favorite.tripStatus || 'scheduled'}</span>
    };
  }

  if (!session) {
    return (
      <section className="wrap" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <p className="hero-eyebrow">SCHOOL BUS ROUTE TRACKER</p>
        <h2 style={{ margin: '0 0 10px', fontSize: 24, color: 'var(--p-ink)' }}>Sign in to see your saved stops</h2>
        <p style={{ color: 'var(--p-muted)', fontSize: 14, marginBottom: 24 }}>Your stops and their next bus times are available after you sign in.</p>
        <a href="#/login" className="btn btn--primary">Sign in</a>
        <a href="#/signup" className="btn" style={{ marginLeft: 8 }}>Create account</a>
      </section>
    );
  }

  return (
    <section className="wrap" style={{ maxWidth: 1080, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 26 }}>
        <p className="hero-eyebrow" style={{ marginBottom: 12 }}>SCHOOL BUS ROUTE TRACKER</p>
        <h2 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--p-ink)' }}>My stops</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--p-muted)' }}>Save the stops you use and see the next bus for each one.</p>
      </div>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <div className="schedule-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        <form onSubmit={saveFavorite} className="card">
          <div className="card__head">
            <h3 className="card__title">Save a stop</h3>
          </div>
          <p className="card__desc">Pick a route, then one stop or the whole route.</p>
          <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <label className="field" htmlFor="route">
              <span className="field__label">Route</span>
              <select id="route" className="select" value={routeId} onChange={(event) => onRouteChange(event.target.value)}>
                <option value="">Choose a route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.code} {route.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="stop">
              <span className="field__label">Stop</span>
              <select
                id="stop"
                className="select"
                value={stopId}
                onChange={(event) => setStopId(event.target.value)}
                disabled={!routeId || stops.length === 0}
              >
                <option value="">Whole route</option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.stopOrder}. {stop.name}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={saving} className="btn btn--primary">
              {saving ? 'Saving...' : 'Save stop'}
            </button>
          </div>
          {formError && <div className="banner banner--error" role="alert" style={{ marginTop: 14, marginBottom: 0 }}>{formError}</div>}
          {message && <div className="banner banner--success" role="status" style={{ marginTop: 14, marginBottom: 0 }}>{message}</div>}
        </form>

        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-ink)' }}>Saved stops</h3>
              <span className="badge">{loading ? 'Loading' : favorites.length}</span>
            </div>

            {loading && <div className="card muted">Loading saved stops...</div>}
            {!loading && !error && favorites.length === 0 && (
              <div className="card schedule-empty">
                <span className="schedule-empty__index">MY STOPS</span>
                <h3>No saved stops yet</h3>
                <p>Save a stop with the form and its next bus time will show here.</p>
              </div>
            )}
            <ul className="row-list">
              {favorites.map((favorite) => {
                const next = arrival(favorite);
                return (
                  <li key={favorite.id} className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--p-ink)' }}>{favorite.routeName}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{favorite.stopName || 'Whole route'}</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                        <div className="schedule-arrival">
                          {next.time ? <strong>{next.time}</strong> : null}
                          <span>{next.text}</span>
                        </div>
                        {next.badge}
                        <button type="button" className="btn btn--danger btn--sm" onClick={() => removeFavorite(favorite.id)}>Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="card">
            <div className="card__head">
              <h3 className="card__title">Upcoming holidays</h3>
              <span className="badge badge--warn">No bus</span>
            </div>
            {holidays.length === 0
              ? <p className="muted" style={{ margin: 0 }}>No holidays coming up.</p>
              : (
                <ul className="row-list" style={{ gap: 8 }}>
                  {holidays.map((holiday) => (
                    <li key={holiday.date} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--p-border)' }}>
                      <span style={{ color: 'var(--p-ink)' }}>{holiday.name}</span>
                      <span className="mono muted">{holidayDate(holiday.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </aside>
        </div>
      </div>
    </section>
  );
}
