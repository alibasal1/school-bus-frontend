import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

// Colors and shapes for this page. Kept here (no global CSS) so this page
// looks the same whatever the rest of the app does.
const C = {
  blue: '#1f3b73',
  text: '#1f2533',
  grey: '#6b7385',
  border: '#e2e6ee',
  yellowBg: '#fff8ec',
  yellowBorder: '#f2d9a6',
  yellowText: '#9a5b00',
  red: '#c0392b',
  green: '#1e7b4f'
};

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', color: C.text, background: '#ffffff' },
  title: { fontSize: 34, fontWeight: 'bold', color: C.text, margin: '8px 0 18px' },
  card: {
    background: '#ffffff',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '20px 22px',
    marginBottom: 14
  },
  yellowCard: { background: C.yellowBg, borderColor: C.yellowBorder },
  greyCard: { background: '#f7f8fb', color: C.grey },
  cardTitle: { fontSize: 18, margin: '0 0 12px' },
  form: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' },
  label: { fontSize: 14, color: C.grey },
  select: {
    padding: '8px 10px',
    fontSize: 15,
    color: C.text,
    background: '#ffffff',
    border: `1px solid ${C.border}`,
    borderRadius: 8
  },
  mainButton: {
    padding: '9px 18px',
    fontSize: 15,
    color: '#ffffff',
    background: C.blue,
    border: `1px solid ${C.blue}`,
    borderRadius: 8,
    cursor: 'pointer'
  },
  button: {
    padding: '7px 16px',
    fontSize: 15,
    color: C.text,
    background: '#ffffff',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    cursor: 'pointer'
  },
  success: { color: C.green, fontSize: 14, margin: '10px 0 0' },
  failure: { color: C.red, fontSize: 14, margin: '10px 0 0' },
  pageError: { color: C.red, fontSize: 14, margin: '0 0 12px' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  stopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  routeName: { fontWeight: 'bold', fontSize: 18 },
  stopName: { color: C.grey, fontSize: 15 },
  arrival: { margin: '8px 0 0', fontSize: 17 },
  noBus: { margin: '8px 0 0', fontSize: 17, color: C.yellowText },
  holidayLine: { padding: '4px 0', color: C.text }
};

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
export default function FavoritesPage() {
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
      const data = await apiRequest('favorites', '/api/favorites');
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
      const data = await apiRequest('favorites', '/api/favorites/options');
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

      const data = await apiRequest('favorites', `/api/holidays?year=${year}`);
      let next = upcoming(data.holidays);
      if (next.length < 3) {
        const following = await apiRequest('favorites', `/api/holidays?year=${year + 1}`);
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
      await apiRequest('favorites', '/api/favorites', {
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
      await apiRequest('favorites', `/api/favorites/${id}`, { method: 'DELETE' });
      setFavorites((current) => current.filter((favorite) => favorite.id !== id));
      setError('');
      confirm('Stop removed.');
    } catch (err) {
      setError(err.message);
    }
  }

  function arrivalLine(favorite) {
    // noBusToday is only true on a public holiday (see services/favorites.js).
    if (favorite.noBusToday) {
      return <p style={styles.noBus}><strong>No bus today</strong> (public holiday)</p>;
    }
    if (!favorite.arrivalFrom) return <p style={styles.arrival}>No upcoming bus time today.</p>;
    return (
      <p style={styles.arrival}>
        Next bus <strong>{favorite.arrivalFrom.slice(0, 5)} – {favorite.arrivalTo.slice(0, 5)}</strong>
      </p>
    );
  }

  if (loading) return <p style={{ color: C.grey }}>Loading saved stops...</p>;

  return (
    <section style={styles.page}>
      <h2 style={styles.title}>My stops</h2>

      <form onSubmit={saveFavorite} style={styles.card}>
        <h3 style={styles.cardTitle}>Save a stop</h3>
        <div style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="route" style={styles.label}>Route</label>
            <select
              id="route"
              style={styles.select}
              value={routeId}
              onChange={(event) => onRouteChange(event.target.value)}
            >
              <option value="">Choose a route</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.code} {route.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label htmlFor="stop" style={styles.label}>Stop</label>
            <select
              id="stop"
              style={styles.select}
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
          </div>

          <button type="submit" disabled={saving} style={{ ...styles.mainButton, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save stop'}
          </button>
        </div>
        {formError && <p role="alert" style={styles.failure}>{formError}</p>}
        {message && <p role="status" style={styles.success}>{message}</p>}
      </form>

      {error && <p role="alert" style={styles.pageError}>{error}</p>}
      {!error && favorites.length === 0 && (
        <div style={{ ...styles.card, ...styles.greyCard }}>You have not saved any stops yet.</div>
      )}
      <ul style={styles.list}>
        {favorites.map((favorite) => (
          <li
            key={favorite.id}
            style={{ ...styles.card, ...(favorite.noBusToday ? styles.yellowCard : {}) }}
          >
            <div style={styles.stopRow}>
              <div>
                <span style={styles.routeName}>{favorite.routeName}</span>
                <span style={styles.stopName}> · {favorite.stopName || 'whole route'}</span>
                {arrivalLine(favorite)}
              </div>
              <button style={styles.button} onClick={() => removeFavorite(favorite.id)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>

      <aside style={styles.card}>
        <h3 style={styles.cardTitle}>Upcoming holidays</h3>
        {holidays.length === 0
          ? <p style={{ margin: 0, color: C.grey }}>No holidays coming up.</p>
          : (
            <ul style={styles.list}>
              {holidays.map((holiday) => (
                <li key={holiday.date} style={styles.holidayLine}>
                  {holidayDate(holiday.date)} · {holiday.name}
                </li>
              ))}
            </ul>
          )}
      </aside>
    </section>
  );
}
