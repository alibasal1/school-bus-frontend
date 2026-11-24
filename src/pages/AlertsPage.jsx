import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

// Alerts page. Owner: Ali (246090).
// The filter asks the API for unread alerts only (?unread=true) instead of
// hiding rows in the browser, so the parent always sees fresh data.
export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function confirm(text) {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  }

  async function loadAlerts(onlyUnread) {
    setLoading(true);
    try {
      const path = onlyUnread ? '/api/alerts?unread=true' : '/api/alerts';
      const data = await apiRequest('favorites', path);
      setAlerts(data.alerts);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts(unreadOnly);
  }, [unreadOnly]);

  // On the unread list every row is unread, so counting the rows is right in
  // both views and needs no second request.
  const unreadCount = unreadOnly
    ? alerts.length
    : alerts.filter((alert) => !alert.isRead).length;

  async function markAsRead(id) {
    try {
      const data = await apiRequest('favorites', `/api/alerts/${id}`, {
        method: 'PATCH',
        body: { isRead: true }
      });
      setAlerts((current) => (
        unreadOnly
          ? current.filter((alert) => alert.id !== id)
          : current.map((alert) => (alert.id === id ? data.alert : alert))
      ));
      setError('');
      confirm('Alert marked as read.');
    } catch (err) {
      setError(err.message);
    }
  }

  // One request per alert, one after the other. The API allows 10 requests a
  // second, so sending them all at once would earn a 429 on a long list.
  async function markAllAsRead() {
    const unread = alerts.filter((alert) => !alert.isRead);
    if (unread.length === 0) return;
    setBusy(true);
    let done = 0;
    try {
      for (const alert of unread) {
        await apiRequest('favorites', `/api/alerts/${alert.id}`, {
          method: 'PATCH',
          body: { isRead: true }
        });
        done += 1;
      }
      setError('');
      confirm(`${done} alert${done === 1 ? '' : 's'} marked as read.`);
    } catch (err) {
      setError(`${done} of ${unread.length} were marked as read. ${err.message}`);
    } finally {
      setBusy(false);
      await loadAlerts(unreadOnly);
    }
  }

  return (
    <section>
      <h2>Alerts</h2>
      <p>{unreadCount} unread</p>

      <label htmlFor="unread-filter">
        <input
          id="unread-filter"
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => setUnreadOnly(event.target.checked)}
        />
        Unread only
      </label>

      <button onClick={markAllAsRead} disabled={busy || unreadCount === 0}>
        {busy ? 'Marking...' : 'Mark all as read'}
      </button>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading alerts...</p>}
      {!loading && !error && alerts.length === 0 && (
        <p>{unreadOnly ? 'You have no unread alerts.' : 'You have no alerts.'}</p>
      )}
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id}>
            <p>{alert.message}</p>
            <small>{alert.isRead ? 'Read' : 'Unread'}</small>
            {!alert.isRead && <button onClick={() => markAsRead(alert.id)}>Mark as read</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
