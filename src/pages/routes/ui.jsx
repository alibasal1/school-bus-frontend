import { useCallback, useState } from 'react';

// Shared pieces for the Route & Stop pages. Owner: Yehia.
//
// React styles only. No .css file and no global stylesheet, so nothing here
// can change how anyone else's page looks. The tokens below are Ali's, taken
// from FavoritesPage and AlertsPage, so the two halves of the app look like
// one app.
//
// Every button carries an explicit colour AND background. Relying on the
// browser default is what produced unreadable buttons on Windows: Chrome on
// Windows draws a light grey button face, and inherited dark-on-dark or
// white-on-white text disappears.

export const tokens = {
  navy: '#1f3b73',       // main buttons, selected state
  text: '#1f2533',
  grey: '#6b7385',
  border: '#e2e6ee',
  surface: '#ffffff',
  page: '#f4f6fa',
  warnBg: '#fff8ec',
  warnBorder: '#f2d9a6',
  warnText: '#9a5b00',
  red: '#c0392b',
  green: '#1e7a46',
  radius: 12,
};

// Chart series. Validated against a white card: lightness band, chroma
// floor, colour-blind separation (ΔE 24.7 protan), normal-vision separation
// (ΔE 33.6) and ≥3:1 contrast all pass. Deliberately not the navy, so a
// bar can never be mistaken for a button.
export const series = { one: '#2a78d6', two: '#eb6834' };

export const styles = {
  card: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: '20px 22px',
    marginBottom: 14,
  },
  row: { display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' },
  input: {
    font: 'inherit',
    fontSize: 15,
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${tokens.border}`,
    background: '#fff',
    color: tokens.text,
  },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: tokens.grey },
  muted: { color: tokens.grey, fontSize: 14 },
  tabBar: { display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 15 },
  th: {
    textAlign: 'left',
    color: tokens.grey,
    fontWeight: 600,
    fontSize: 13,
    borderBottom: `2px solid ${tokens.border}`,
    padding: '8px 10px',
  },
  td: {
    borderBottom: `1px solid ${tokens.border}`,
    padding: '9px 10px',
    verticalAlign: 'top',
    color: tokens.text,
  },
  pageTitle: { fontSize: 34, fontWeight: 700, color: tokens.text, margin: '0 0 14px' },
  cardTitle: { fontSize: 18, fontWeight: 700, color: tokens.text, margin: '0 0 10px' },
  button: {
    font: 'inherit',
    fontSize: 15,
    padding: '8px 14px',
    borderRadius: 8,
    border: `1px solid ${tokens.border}`,
    background: '#fff',
    color: tokens.text,
    cursor: 'pointer',
  },
  buttonPrimary: {
    font: 'inherit',
    fontSize: 15,
    padding: '8px 14px',
    borderRadius: 8,
    border: `1px solid ${tokens.navy}`,
    background: tokens.navy,
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

/**
 * Every button on these pages.
 *
 * Exists so that no button can be rendered without an explicit colour and
 * background. `primary` gives the navy fill; everything else is white with a
 * grey border and dark text.
 */
export function Btn({ primary, disabled, style, children, ...rest }) {
  const base = primary ? styles.buttonPrimary : styles.button;
  return (
    <button
      type="button"
      disabled={disabled}
      {...rest}
      style={{
        ...base,
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Shows an error from the API.
 *
 * The API answers every failure with { error: { code, message, request_id } }
 * and api.js copies those onto the thrown Error. The request id is shown
 * because it is what ties a complaint to a line in the server log.
 *
 * A 409 from the trips endpoints carries details.conflicts: the list of
 * reasons the timetable refused the change. Showing them is the whole value
 * of that endpoint.
 */
export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  const conflicts = error.details?.conflicts;

  return (
    <div
      role="alert"
      style={{
        ...styles.card,
        borderColor: tokens.red,
        background: '#fdf1f0',
        color: tokens.red,
      }}
    >
      <div style={styles.row}>
        <strong style={{ flex: 1 }}>{error.message}</strong>
        {onDismiss && <Btn onClick={onDismiss}>Dismiss</Btn>}
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
        <p style={{ ...styles.muted, color: tokens.red, margin: '8px 0 0' }}>
          Reference: <code>{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

/** A short green line after something worked, like Ali's pages. */
export function SuccessNote({ children, onDismiss }) {
  if (!children) return null;
  return (
    <p style={{ color: tokens.green, fontSize: 15, margin: '8px 0' }} role="status">
      {children}
      {onDismiss && (
        <Btn onClick={onDismiss} style={{ marginLeft: 10, padding: '2px 8px', fontSize: 13 }}>
          OK
        </Btn>
      )}
    </p>
  );
}

export function Spinner({ children = 'Loading…' }) {
  return <p style={styles.muted}>{children}</p>;
}

export function Empty({ children }) {
  return <p style={styles.muted}>{children}</p>;
}

/** A button that disables itself and shows progress while its action runs. */
export function BusyButton({ busy, children, disabled, ...rest }) {
  return (
    <Btn disabled={busy || disabled} {...rest}>
      {busy ? 'Working…' : children}
    </Btn>
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
        <Btn
          key={tab.key}
          primary={tab.key === current}
          onClick={() => onChange(tab.key)}
          aria-current={tab.key === current ? 'page' : undefined}
        >
          {tab.label}
        </Btn>
      ))}
    </nav>
  );
}

export function Badge({ tone = 'neutral', children }) {
  // Each badge always carries a word, so the colour is never the only cue.
  const tones = {
    neutral: { background: '#eef1f6', color: tokens.grey, border: `1px solid ${tokens.border}` },
    good: { background: '#e9f6ee', color: tokens.green, border: '1px solid #bfe3cd' },
    bad: { background: '#fdf1f0', color: tokens.red, border: '1px solid #f0c5c0' },
    warn: { background: tokens.warnBg, color: tokens.warnText, border: `1px solid ${tokens.warnBorder}` },
  };
  return (
    <span
      style={{
        ...tones[tone],
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: 13,
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
 * the request runs, show the error if it fails, and refresh afterwards if it
 * succeeds. Doing that by hand in each handler is where the "clicked twice
 * and created two routes" bugs come from.
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
// The API sends and expects calendar days as YYYY-MM-DD, never timestamps: a
// trip on 2026-03-01 is the same trip whatever timezone the browser is in.
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
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => ({
  value: index + 1,
  label,
}));
