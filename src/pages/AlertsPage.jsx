import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

// Colors and shapes for this page. Kept here (no global CSS) so this page
// looks the same whatever the rest of the app does.
const C = {
  blue: '#1f3b73',
  lightBlue: '#e6ecf7',
  text: '#1f2533',
  grey: '#6b7385',
  border: '#e2e6ee',
  yellowText: '#9a5b00',
  red: '#c0392b',
  green: '#1e7b4f'
};

const styles = {
  page: { maxWidth: 900, margin: '0 auto', color: C.text, background: '#ffffff' },
  header: { display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 12px' },
  title: { fontSize: 28, margin: 0 },
  pill: {
    background: C.lightBlue,
    color: C.blue,
    fontWeight: 'bold',
    fontSize: 14,
    padding: '4px 12px',
    borderRadius: 999
  },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 16 },
  filter: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: C.text },
  mainButton: {
    padding: '8px 16px',
    fontSize: 15,
    color: '#ffffff',
    background: C.blue,
    border: `1px solid ${C.blue}`,
    borderRadius: 8,
    cursor: 'pointer'
  },
  smallButton: {
    padding: '3px 10px',
    fontSize: 14,
    color: C.text,
    background: '#ffffff',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    cursor: 'pointer'
  },
  success: { color: C.green, fontSize: 14, margin: '0 0 12px' },
  failure: { color: C.red, fontSize: 14, margin: '0 0 12px' },
  loading: { color: C.grey, margin: '0 0 12px' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  card: {
    background: '#ffffff',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '16px 18px',
    marginBottom: 12
  },
  greyCard: { background: '#f7f8fb', color: C.grey },
  message: { margin: 0, fontSize: 17 },
  meta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, color: C.grey }
};

// The colored bar on an unread alert says what kind of message it is.
const BAR_COLORS = {
  boarding: C.blue,
  almost_dropped: C.blue,
  dropped: C.blue,
  cancel: C.red,
  trip_change: C.red,
  holiday: C.yellowText
};

// "Today 07:14", "Yesterday 20:00" or "21 Nov 18:18", in Cairo time.
function alertTime(value) {
  const cairo = (date, options) => date.toLocaleString('en-GB', { timeZone: 'Africa/Cairo', ...options });
  const created = new Date(value);
  const day = (date) => cairo(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = cairo(created, { hour: '2-digit', minute: '2-digit', hour12: false });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day(created) === day(now)) return `Today ${time}`;
  if (day(created) === day(yesterday)) return `Yesterday ${time}`;
  return `${cairo(created, { day: 'numeric', month: 'short' })} ${time}`;
}

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

  const markAllDisabled = busy || unreadCount === 0;

  function cardStyle(alert) {
    if (alert.isRead) return { ...styles.card, opacity: 0.6 };
    return {
      ...styles.card,
      borderLeft: `5px solid ${BAR_COLORS[alert.type] || C.blue}`
    };
  }

  return (
    <section style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Alerts</h2>
        <span style={styles.pill}>{unreadCount} unread</span>
      </div>

      <div style={styles.toolbar}>
        <label htmlFor="unread-filter" style={styles.filter}>
          <input
            id="unread-filter"
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          Unread only
        </label>

        <button
          onClick={markAllAsRead}
          disabled={markAllDisabled}
          style={{ ...styles.mainButton, opacity: markAllDisabled ? 0.5 : 1, cursor: markAllDisabled ? 'default' : 'pointer' }}
        >
          {busy ? 'Marking...' : 'Mark all as read'}
        </button>
      </div>

      {message && <p role="status" style={styles.success}>{message}</p>}
      {error && <p role="alert" style={styles.failure}>{error}</p>}
      {loading && <p style={styles.loading}>Loading alerts...</p>}
      {!loading && !error && alerts.length === 0 && (
        <div style={{ ...styles.card, ...styles.greyCard }}>
          {unreadOnly ? 'No unread alerts.' : 'No alerts.'}
        </div>
      )}
      <ul style={styles.list}>
        {alerts.map((alert) => (
          <li key={alert.id} style={cardStyle(alert)}>
            <p style={{ ...styles.message, fontWeight: alert.isRead ? 'normal' : 'bold' }}>{alert.message}</p>
            <div style={styles.meta}>
              <span>{alertTime(alert.createdAt)}</span>
              <span>·</span>
              {alert.isRead
                ? <span>Read</span>
                : <button style={styles.smallButton} onClick={() => markAsRead(alert.id)}>Mark as read</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
