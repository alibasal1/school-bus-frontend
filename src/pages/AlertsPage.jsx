import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { getSession } from '../auth';

// The badge on each alert says what kind of message it is.
const TYPE_LABELS = {
  boarding: { text: 'Boarded', badge: 'badge' },
  almost_dropped: { text: 'Almost there', badge: 'badge' },
  dropped: { text: 'Dropped off', badge: 'badge' },
  cancel: { text: 'Cancelled', badge: 'badge badge--danger' },
  trip_change: { text: 'Trip change', badge: 'badge badge--warn' },
  holiday: { text: 'Holiday', badge: 'badge badge--warn' }
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
// The look comes from the shared theme (src/styles/theme.css), like Ahmed's pages.
export default function AlertsPage() {
  const session = getSession();
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
    // No session: the Sign in block is shown and nothing is asked from the API.
    if (!session) {
      setLoading(false);
      return;
    }
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

  if (!session) {
    return (
      <section className="wrap" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <p className="hero-eyebrow">SCHOOL BUS ROUTE TRACKER</p>
        <h2 style={{ margin: '0 0 10px', fontSize: 24, color: 'var(--p-ink)' }}>Sign in to see your alerts</h2>
        <p style={{ color: 'var(--p-muted)', fontSize: 14, marginBottom: 24 }}>Boarding, drop-off and trip alerts are available after you sign in.</p>
        <a href="#/login" className="btn btn--primary">Sign in</a>
        <a href="#/signup" className="btn" style={{ marginLeft: 8 }}>Create account</a>
      </section>
    );
  }

  return (
    <section className="wrap" style={{ maxWidth: 1080, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 26 }}>
        <div>
          <p className="hero-eyebrow" style={{ marginBottom: 12 }}>SCHOOL BUS ROUTE TRACKER</p>
          <h2 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--p-ink)' }}>
            Alerts <span className="badge badge--accent" style={{ verticalAlign: 'middle' }}>{unreadCount} unread</span>
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--p-muted)' }}>Boarding, drop-off, trip and holiday messages for your child.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <label htmlFor="unread-filter" className="field__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              id="unread-filter"
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              style={{ accentColor: 'var(--p-accent)', width: 16, height: 16 }}
            />
            Unread only
          </label>
          <button type="button" className="btn btn--primary btn--sm" onClick={markAllAsRead} disabled={busy || unreadCount === 0}>
            {busy ? 'Marking...' : 'Mark all as read'}
          </button>
        </div>
      </div>

      {message && <div className="banner banner--success" role="status">{message}</div>}
      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {loading && <div className="card muted">Loading alerts...</div>}
      {!loading && !error && alerts.length === 0 && (
        <div className="card schedule-empty">
          <span className="schedule-empty__index">ALERTS</span>
          <h3>{unreadOnly ? 'No unread alerts' : 'No alerts yet'}</h3>
          <p>{unreadOnly ? 'You have read every alert.' : 'Messages about your bus will show here.'}</p>
        </div>
      )}

      <ul className="row-list">
        {alerts.map((alert) => {
          const kind = TYPE_LABELS[alert.type] || { text: alert.type, badge: 'badge' };
          return (
            <li
              key={alert.id}
              className="card"
              style={{
                padding: '16px 18px',
                opacity: alert.isRead ? 0.65 : 1,
                boxShadow: alert.isRead ? 'none' : 'inset 3px 0 var(--p-accent)'
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 8, minWidth: 0, flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span className={kind.badge}>{kind.text}</span>
                    {alert.isRead
                      ? <span className="badge">Read</span>
                      : <span className="badge badge--accent">Unread</span>}
                    <span className="mono muted">{alertTime(alert.createdAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: 'var(--p-ink)', fontWeight: alert.isRead ? 400 : 600 }}>{alert.message}</p>
                </div>
                {!alert.isRead && (
                  <button type="button" className="btn btn--sm" onClick={() => markAsRead(alert.id)}>Mark as read</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
