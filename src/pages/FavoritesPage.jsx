import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [saving, setSaving] = useState(false);

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
      setRoutes(data.routes);
    } catch {
      // The list of saved stops still shows; the form just stays empty.
    }
  }

  useEffect(() => {
    loadFavorites();
    loadOptions();
  }, []);

  async function saveFavorite(event) {
    event.preventDefault();
    if (!routeId) {
      setError('Choose a route first.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('favorites', '/api/favorites', {
        method: 'POST',
        body: { routeId, stopId: stopId || null },
      });
      setRouteId('');
      setStopId('');
      await loadFavorites();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const chosenRoute = routes.find((route) => route.id === routeId);

  async function removeFavorite(id) {
    try {
      await apiRequest('favorites', `/api/favorites/${id}`, { method: 'DELETE' });
      setFavorites((current) => current.filter((favorite) => favorite.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>Loading saved stops...</p>;

  return (
    <section>
      <h2>My stops</h2>
      <form onSubmit={saveFavorite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Route{' '}
          <select value={routeId} onChange={(e) => { setRouteId(e.target.value); setStopId(''); }}>
            <option value="">Choose a route</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>{route.code} {route.name}</option>
            ))}
          </select>
        </label>
        <label>
          Stop{' '}
          <select value={stopId} onChange={(e) => setStopId(e.target.value)} disabled={!chosenRoute}>
            <option value="">Whole route</option>
            {(chosenRoute ? chosenRoute.stops : []).map((stop) => (
              <option key={stop.id} value={stop.id}>{stop.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={saving || !routeId}>{saving ? 'Saving...' : 'Save stop'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {!error && favorites.length === 0 && <p>You have no saved stops yet.</p>}
      <ul>
        {favorites.map((favorite) => (
          <li key={favorite.id}>
            <strong>{favorite.routeName}</strong>
            {favorite.stopName && <span> — {favorite.stopName}</span>}
            <p>
              {favorite.noBusToday
                ? 'No bus today'
                : favorite.arrivalFrom
                  ? `Next arrival: ${favorite.arrivalFrom.slice(0, 5)}–${favorite.arrivalTo.slice(0, 5)}`
                  : 'No upcoming bus time today.'}
            </p>
            <button onClick={() => removeFavorite(favorite.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
