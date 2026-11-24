import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

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

  async function loadHolidays() {
    try {
      const data = await apiRequest('favorites', '/api/holidays');
      const today = new Date().toISOString().slice(0, 10);
      const next = (data.holidays || [])
        .filter((holiday) => holiday.date >= today)
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

  function arrivalText(favorite) {
    if (favorite.noBusToday) return 'No bus today';
    if (!favorite.arrivalFrom) return 'No upcoming bus time today.';
    return `Next arrival: ${favorite.arrivalFrom.slice(0, 5)}-${favorite.arrivalTo.slice(0, 5)}`;
  }

  if (loading) return <p>Loading saved stops...</p>;

  return (
    <section>
      <h2>My stops</h2>

      <form onSubmit={saveFavorite}>
        <h3>Save a stop</h3>
        <label htmlFor="route">Route</label>
        <select id="route" value={routeId} onChange={(event) => onRouteChange(event.target.value)}>
          <option value="">Choose a route</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.code} {route.name}
            </option>
          ))}
        </select>

        <label htmlFor="stop">Stop</label>
        <select
          id="stop"
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

        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save stop'}</button>
        {formError && <p role="alert">{formError}</p>}
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {!error && favorites.length === 0 && <p>You have no saved stops yet.</p>}
      <ul>
        {favorites.map((favorite) => (
          <li key={favorite.id}>
            <strong>{favorite.routeName}</strong>
            {favorite.stopName && <span> {favorite.stopName}</span>}
            <p>{arrivalText(favorite)}</p>
            <button onClick={() => removeFavorite(favorite.id)}>Remove</button>
          </li>
        ))}
      </ul>

      <aside>
        <h3>Upcoming holidays</h3>
        {holidays.length === 0
          ? <p>No holidays coming up.</p>
          : (
            <ul>
              {holidays.map((holiday) => (
                <li key={holiday.date}>{holiday.date}: {holiday.name}</li>
              ))}
            </ul>
          )}
      </aside>
    </section>
  );
}
