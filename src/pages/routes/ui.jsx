import { useCallback, useState } from 'react';

// Small shared pieces for the Route & Stop page. Owner: Yehia.
//
// Inline styles, to match the rest of this app and to avoid touching any
// shared build configuration. Nothing here is specific to routes or trips,
// so each piece can be read on its own.

export const styles = {
  card: {
    border: '1px solid #d6d6d6',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    background: '#fff',
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { padding: '6px 8px', border: '1px solid #bbb', borderRadius: 4, font: 'inherit' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 },
  muted: { color: '#666', fontSize: 14 },
  tabBar: { display: 'flex', gap: 8, margin: '12px 0' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14 },
  th: { textAlign: 'left', borderBottom: '2px solid #ddd', padding: '6px 8px' },
  td: { borderBottom: '1px solid #eee', padding: '6px 8px', verticalAlign: 'top' },
};

/**
 * Shows an error from the API.
 *
 * The API answers every failure with { error: { code, message, request_id } }
 * and api.js copies those onto the thrown Error. The request id is shown
 * because it is what ties a complaint to a line in the server log — without
 * it "it broke" is unsearchable.
 *
 * A 409 from the trips endpoints carries details.conflicts: the list of
 * reasons the timetable refused the change. Showing them is the whole value
 * of that endpoint, so they are rendered rather than swallowed.
 */
export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  const conflicts = error.details?.conflicts;

  return (
    <div
      role="alert"
      style={{
        ...styles.card,
        borderColor: '#c62828',
        background: '#fdecea',
      }}
    >
      <div style={styles.row}>
        <strong style={{ flex: 1 }}>{error.message}</strong>
        {onDismiss && (
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>

      {conflicts && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {conflicts.map((conflict) => (
            <li key={conflict.code}>
              <code>{conflict.code}</code> — {conflict.message}
            </li>
          ))}
        </ul>
      )}

      {error.requestId && (
        <p style={{ ...styles.muted, margin: '8px 0 0' }}>
          Reference: <code>{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

export function Spinner({ children = 'Loading…' }) {
  return <p style={styles.muted}>{children}</p>;
}

export function Empty({ children }) {
  return <p style={styles.muted}>{children}</p>;
}

/** A button that disables itself and shows progress while its action runs. */
export function BusyButton({ busy, children, ...rest }) {
  return (
    <button type="button" disabled={busy || rest.disabled} {...rest}>
      {busy ? 'Working…' : children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={styles.label}>
      <span>{label}</span>
      {children}
      {hint && <span style={styles.muted}>{hint}</span>}
    </label>
  );
}

export function Tabs({ tabs, current, onChange }) {
  return (
    <nav style={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          disabled={tab.key === current}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: { background: '#eee', color: '#333' },
    good: { background: '#e3f4e5', color: '#1b5e20' },
    bad: { background: '#fdecea', color: '#c62828' },
    warn: { background: '#fff6e0', color: '#8a6100' },
  };
  return (
    <span
      style={{
        ...tones[tone],
        borderRadius: 10,
        padding: '2px 8px',
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Runs one write at a time and tracks whether it is in flight.
 *
 * Every admin action needs the same three things: disable the button while
 * the request is running, show the error if it fails, and refresh afterwards
 * if it succeeds. Doing that by hand in each handler is where the "clicked
 * twice and created two routes" bugs come from.
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
// a trip on 2026-03-01 is the same trip whatever timezone the browser is in.
// These helpers keep that true on this side too, so nothing is ever built
// from a Date object that could roll over at midnight.

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysIso(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Pretty "Sun 1 Mar 2026" for a YYYY-MM-DD string, without timezone drift. */
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

/** ISO day numbers, as the API uses them: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = WEEKDAY_NAMES.map((label, index) => ({ value: index + 1, label }));
