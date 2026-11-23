import { useCallback, useState } from 'react';

// Small shared pieces for the Route & Stop page. Owner: Yehia.
//
// Inline styles, to match the rest of this app and to avoid touching any
// shared build configuration. Nothing here is specific to routes or trips,
// so each piece can be read on its own.

// The page's components use these inline, so re-pointing them at the theme's
// custom properties restyles the whole Route & Stop page in one place.
// Anything structural (padding, layout) stays here; anything that is a colour
// defers to src/styles/theme.css, so light/dark or a palette change never has
// to be chased through the components.
export const styles = {
  card: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '16px 18px',
    marginBottom: 14,
  },
  row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  input: {}, // styled globally in theme.css
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' },
  muted: { color: 'var(--text-muted)', fontSize: 12.5 },
  tabBar: { display: 'flex', gap: 8, margin: '14px 0' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13.5 },
  th: {},  // styled globally
  td: {},  // styled globally
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
        borderColor: 'var(--critical)',
        background: 'rgba(208, 59, 59, 0.10)',
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
  // Status colours sit on a tinted wash of themselves rather than a solid
  // fill, so they stay legible on the dark surface. Each badge always carries
  // a word, never colour alone.
  const tones = {
    neutral: { background: 'var(--surface-3)', color: 'var(--text-secondary)' },
    good: { background: 'rgba(12, 163, 12, 0.16)', color: 'var(--good)' },
    bad: { background: 'rgba(208, 59, 59, 0.16)', color: 'var(--critical)' },
    warn: { background: 'rgba(250, 178, 25, 0.16)', color: 'var(--warning)' },
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
