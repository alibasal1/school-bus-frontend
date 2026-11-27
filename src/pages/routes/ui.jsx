import { useCallback, useState } from 'react';

// Shared pieces for the Route & Stop page. Owner: Yehia (247330).
//
// Every colour, border and font comes from the shared classes in
// src/styles/theme.css: card, btn, btn--primary, field, input, select,
// badge, banner, data-table. No .css file is added here and nothing is
// styled globally, so this page cannot change how anyone else's page looks.
//
// `styles` below holds layout only, never colour. It exists because the
// admin views use it for spacing; anything visual belongs in a class.

export const styles = {
  row: { display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' },
  stack: { display: 'grid', gap: 14 },
  right: { marginLeft: 'auto' },
  tight: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
};

/**
 * Every button on this page.
 *
 * It exists so no button can be rendered without one of the theme's button
 * classes. A bare <button> on Windows gets Chrome's light grey face and
 * inherits whatever text colour is around it, which on a dark page makes
 * the label invisible. That was the reported bug.
 */
export function Btn({ primary, danger, small, className = '', children, ...rest }) {
  const classes = ['btn'];
  if (primary) classes.push('btn--primary');
  if (danger) classes.push('btn--danger');
  if (small) classes.push('btn--sm');
  if (className) classes.push(className);
  return (
    <button type="button" className={classes.join(' ')} {...rest}>
      {children}
    </button>
  );
}

/** A button that disables itself and says so while its action runs. */
export function BusyButton({ busy, children, disabled, ...rest }) {
  return (
    <Btn disabled={busy || disabled} {...rest}>
      {busy ? 'Working...' : children}
    </Btn>
  );
}

/**
 * An error from the API.
 *
 * Every failure arrives as { error: { code, message, request_id } }. The
 * request id is shown because it is what ties a complaint to a line in the
 * CloudWatch log. A 409 from the trips endpoints also carries the list of
 * reasons the timetable refused the change, and showing them is the whole
 * value of that endpoint.
 */
export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  const conflicts = error.details?.conflicts;

  return (
    <div className="banner banner--error" role="alert">
      <div style={styles.row}>
        <strong style={{ flex: 1 }}>{error.message}</strong>
        {onDismiss && (
          <Btn small onClick={onDismiss}>
            Dismiss
          </Btn>
        )}
      </div>

      {conflicts && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {conflicts.map((conflict) => (
            <li key={conflict.code}>
              <span className="mono">{conflict.code}</span> — {conflict.message}
            </li>
          ))}
        </ul>
      )}

      {error.requestId && (
        <p className="muted" style={{ margin: '8px 0 0' }}>
          Reference: <span className="mono">{error.requestId}</span>
        </p>
      )}
    </div>
  );
}

/** A short confirmation after something worked, like Ali's pages. */
export function SuccessNote({ children, onDismiss }) {
  if (!children) return null;
  return (
    <div className="banner banner--success" role="status">
      <div style={styles.row}>
        <span style={{ flex: 1 }}>{children}</span>
        {onDismiss && (
          <Btn small onClick={onDismiss}>
            OK
          </Btn>
        )}
      </div>
    </div>
  );
}

export function Spinner({ children = 'Loading...' }) {
  return <p className="muted">{children}</p>;
}

export function Empty({ children }) {
  return <p className="muted">{children}</p>;
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="muted">{hint}</span>}
    </label>
  );
}

export function Card({ title, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card__head">
          {title && <h3 className="card__title">{title}</h3>}
          {actions && <div style={styles.tight}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs({ tabs, current, onChange }) {
  return (
    <nav className="nav-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`nav-tab${tab.key === current ? ' nav-tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
          aria-current={tab.key === current ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/** Colour is never the only cue: every badge carries a word as well. */
export function Badge({ tone = 'neutral', children }) {
  const suffix = { good: ' badge--accent', bad: ' badge--danger', warn: ' badge--warn' };
  return <span className={`badge${suffix[tone] || ''}`}>{children}</span>;
}

export function Table({ head, children }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * Runs one write at a time and tracks whether it is in flight.
 *
 * Every admin action needs the same three things: disable the button while
 * the request runs, show the error if it fails, and refresh if it succeeds.
 * Doing that by hand in each handler is where "clicked twice and created
 * two routes" comes from.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (action) => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (caught) {
      setError(caught);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}

// --- dates ------------------------------------------------------------------
// The API sends and expects calendar days as YYYY-MM-DD, never timestamps:
// a day is the same day whatever timezone the browser is in. Everything
// here works in UTC so a date can never shift by one at midnight.

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysIso(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** "Sun 1 Mar 2026" from a YYYY-MM-DD string, without timezone drift. */
export function formatIsoDate(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** ISO day numbers, as the API uses them: 1 = Monday ... 7 = Sunday. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => ({
  value: index + 1,
  label,
}));
