// Admin: generating trips, and cancelling them. Owner: Yehia.
//
// The two screens the doctor's feedback is really about. Neither is a form
// that writes a row: generation asks the server what *should* exist and
// shows its reasoning before anything is written, and cancelling shows who
// it affects before it happens.

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { newIdempotencyKey } from './turnstile';
import {
  Badge,
  BusyButton,
  Empty,
  ErrorBanner,
  Field,
  Spinner,
  addDaysIso,
  formatIsoDate,
  styles,
  todayIso,
  useAction,
} from './ui';

// The server's skip codes, in words. Shown instead of the raw code so the
// preview explains itself: a shorter list with no reasons looks like a bug.
const SKIP_LABELS = {
  not_a_service_day: 'Not a service day for this route',
  outside_schedule_window: 'Outside the pattern’s start/end dates',
  public_holiday: 'Public holiday',
  trip_already_exists: 'A trip already exists for that slot',
  conflict: 'Clashes with the timetable',
};

export function TripsTab({ routes }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);

  return (
    <section>
      <GeneratePanel routes={routes} onCommitted={refresh} />
      <TripList routes={routes} refreshToken={refreshToken} onChanged={refresh} />
    </section>
  );
}

/**
 * Preview, then commit.
 *
 * The API defaults to a preview and only writes when dry_run is explicitly
 * false, so the two buttons below are not a nicety — sending the same
 * request without the flag is harmless. The same Idempotency-Key is used for
 * the commit that follows a preview, so pressing "Create" twice cannot
 * produce two months of trips.
 */
function GeneratePanel({ routes, onCommitted }) {
  const today = todayIso();
  const [form, setForm] = useState({
    from: today,
    to: addDaysIso(today, 13),
    route_id: '',
  });
  const [preview, setPreview] = useState(null);
  const [committed, setCommitted] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const { busy, error, setError, run } = useAction();

  function body(dryRun) {
    return {
      from: form.from,
      to: form.to,
      route_id: form.route_id || null,
      dry_run: dryRun,
    };
  }

  async function doPreview() {
    setCommitted(null);
    const result = await run(() =>
      apiRequest('routes', '/api/trips/generate', { method: 'POST', body: body(true) })
    );
    if (result) setPreview(result);
  }

  async function doCommit() {
    const result = await run(() =>
      apiRequest('routes', '/api/trips/generate', {
        method: 'POST',
        body: body(false),
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    );
    if (result) {
      setCommitted(result);
      setPreview(null);
      setIdempotencyKey(newIdempotencyKey());
      onCommitted();
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>Generate trips from the saved patterns</h3>
      <p style={styles.muted}>
        Expands each route’s recurring pattern over the dates below, skipping weekends, public
        holidays, days that already have a trip, and anything that would double-book a bus or a
        supervisor. Nothing is written until you press Create.
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div style={styles.row}>
        <Field label="From">
          <input
            style={styles.input}
            type="date"
            value={form.from}
            onChange={(event) => setForm({ ...form, from: event.target.value })}
          />
        </Field>
        <Field label="To" hint="At most 120 days.">
          <input
            style={styles.input}
            type="date"
            value={form.to}
            onChange={(event) => setForm({ ...form, to: event.target.value })}
          />
        </Field>
        <Field label="Route">
          <select
            style={styles.input}
            value={form.route_id}
            onChange={(event) => setForm({ ...form, route_id: event.target.value })}
          >
            <option value="">All routes</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.code}
              </option>
            ))}
          </select>
        </Field>
        <BusyButton busy={busy} onClick={doPreview}>
          Preview
        </BusyButton>
      </div>

      {committed && (
        <p style={{ marginTop: 12 }}>
          <Badge tone="good">Created {committed.created}</Badge>{' '}
          <span style={styles.muted}>
            trip{committed.created === 1 ? '' : 's'} between {committed.summary.from} and{' '}
            {committed.summary.to}.
          </span>
        </p>
      )}

      {preview && <PreviewResult preview={preview} busy={busy} onCommit={doCommit} />}
    </div>
  );
}

function PreviewResult({ preview, busy, onCommit }) {
  const { summary, trips, skipped } = preview;
  const byReason = summary.skipped_by_reason || {};

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div style={styles.row}>
        <Badge tone={summary.planned > 0 ? 'good' : 'warn'}>{summary.planned} to create</Badge>
        <Badge>{summary.skipped} skipped</Badge>
        <span style={styles.muted}>
          {summary.days} day{summary.days === 1 ? '' : 's'}, {summary.schedules} pattern
          {summary.schedules === 1 ? '' : 's'}
        </span>
      </div>

      {summary.schedules === 0 && (
        <Empty>
          No patterns are saved, so there is nothing to expand. Set one on the Schedule tab first.
        </Empty>
      )}

      {Object.keys(byReason).length > 0 && (
        <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 14 }}>
          {Object.entries(byReason).map(([reason, count]) => (
            <li key={reason}>
              {SKIP_LABELS[reason] || reason}: <strong>{count}</strong>
            </li>
          ))}
        </ul>
      )}

      {trips.length > 0 && (
        <details open>
          <summary style={{ cursor: 'pointer' }}>Trips that would be created</summary>
          <table style={{ ...styles.table, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={styles.th}>Day</th>
                <th style={styles.th}>Run</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={`${trip.route_id}-${trip.service_date}-${trip.run_type}`}>
                  <td style={styles.td}>{formatIsoDate(trip.service_date)}</td>
                  <td style={styles.td}>{trip.run_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* Only the clashes are listed one by one. Showing all 40 "not a
          service day" rows would bury the handful that need a decision. */}
      {skipped.some((entry) => entry.reason === 'conflict') && (
        <details open>
          <summary style={{ cursor: 'pointer', color: 'var(--critical)' }}>Refused because of a clash</summary>
          <ul style={{ paddingLeft: 20, fontSize: 14 }}>
            {skipped
              .filter((entry) => entry.reason === 'conflict')
              .map((entry) => (
                <li key={`${entry.route_id}-${entry.service_date}-${entry.run_type}`}>
                  {formatIsoDate(entry.service_date)} ({entry.run_type}):{' '}
                  {entry.conflicts?.map((conflict) => conflict.message).join(' ')}
                </li>
              ))}
          </ul>
        </details>
      )}

      <BusyButton busy={busy} onClick={onCommit} disabled={summary.planned === 0}>
        Create these {summary.planned} trips
      </BusyButton>
    </div>
  );
}

function TripList({ routes, refreshToken, onChanged }) {
  const today = todayIso();
  const [filters, setFilters] = useState({
    route_id: '',
    from: today,
    to: addDaysIso(today, 27),
    status: '',
    run_type: '',
  });
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ limit: '200' });
      for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
      }
      const data = await apiRequest('routes', `/api/trips?${query}`);
      setTrips(data.items);
      setError(null);
    } catch (caught) {
      setError(caught);
      setTrips([]);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>Trips</h3>

      <div style={styles.row}>
        <Field label="Route">
          <select
            style={styles.input}
            value={filters.route_id}
            onChange={(event) => setFilters({ ...filters, route_id: event.target.value })}
          >
            <option value="">All</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input
            style={styles.input}
            type="date"
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
        </Field>
        <Field label="To">
          <input
            style={styles.input}
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            style={styles.input}
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">Any</option>
            <option value="active">active</option>
            <option value="cancelled">cancelled</option>
          </select>
        </Field>
        <Field label="Run">
          <select
            style={styles.input}
            value={filters.run_type}
            onChange={(event) => setFilters({ ...filters, run_type: event.target.value })}
          >
            <option value="">Any</option>
            <option value="morning">morning</option>
            <option value="afternoon">afternoon</option>
          </select>
        </Field>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!trips && <Spinner>Loading trips…</Spinner>}
      {trips && trips.length === 0 && <Empty>No trips match these filters.</Empty>}

      {trips && trips.length > 0 && (
        <table style={{ ...styles.table, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={styles.th}>Day</th>
              <th style={styles.th}>Route</th>
              <th style={styles.th}>Run</th>
              <th style={styles.th}>Bus</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Source</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id}>
                <td style={styles.td}>{formatIsoDate(trip.service_date)}</td>
                <td style={styles.td}>{trip.route_code}</td>
                <td style={styles.td}>{trip.run_type}</td>
                <td style={styles.td}>
                  {trip.plate_number || <span style={styles.muted}>none</span>}
                </td>
                <td style={styles.td}>
                  {trip.status === 'cancelled' ? (
                    <>
                      <Badge tone="bad">cancelled</Badge>
                      {trip.cancellation_reason && (
                        <div style={styles.muted}>{trip.cancellation_reason}</div>
                      )}
                    </>
                  ) : (
                    <Badge tone="good">active</Badge>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={styles.muted}>{trip.source}</span>
                </td>
                <td style={styles.td}>
                  {trip.status === 'active' && (
                    <button type="button" onClick={() => setCancelling(trip)}>
                      Cancel…
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {cancelling && (
        <CancelDialog
          trip={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/**
 * Cancel a trip, after showing who it affects.
 *
 * The impact is fetched first, from a separate read-only endpoint, so the
 * admin sees the number of families before deciding rather than after. The
 * reason is required by the API, and it is not paperwork: it is the text
 * that ends up in the parents' alert.
 */
function CancelDialog({ trip, onClose, onDone }) {
  const [impact, setImpact] = useState(null);
  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState(null);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    apiRequest('routes', `/api/trips/${trip.id}/impact`).then(setImpact).catch(setLoadError);
  }, [trip.id]);

  async function confirm() {
    const result = await run(() =>
      apiRequest('routes', `/api/trips/${trip.id}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled', reason: reason.trim() },
      })
    );
    if (result) onDone();
  }

  return (
    <div
      style={{
        ...styles.card,
        borderColor: 'var(--critical)',
        marginTop: 12,
      }}
      role="dialog"
      aria-label="Cancel trip"
    >
      <h4 style={{ marginTop: 0 }}>
        Cancel {trip.route_code} · {trip.run_type} · {formatIsoDate(trip.service_date)}
      </h4>

      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!impact && !loadError && <Spinner>Working out who this affects…</Spinner>}

      {impact && (
        <>
          <p>
            <strong>{impact.stop_count}</strong> stop{impact.stop_count === 1 ? '' : 's'} on this
            route
            {impact.affected_students === null ? (
              <span style={styles.muted}>
                {' '}
                · the student list is not available, so the number of families cannot be shown
              </span>
            ) : (
              <>
                {' '}
                · <strong>{impact.affected_students}</strong> student
                {impact.affected_students === 1 ? '' : 's'} and{' '}
                <strong>{impact.affected_parents}</strong> parent
                {impact.affected_parents === 1 ? '' : 's'} will be told
              </>
            )}
          </p>
          <ul style={{ fontSize: 14, paddingLeft: 20 }}>
            {impact.stops.map((stop) => (
              <li key={stop.id}>
                {stop.stop_order}. {stop.name}
              </li>
            ))}
          </ul>
        </>
      )}

      <Field label="Reason (sent to the parents)" hint="3–200 characters.">
        <input
          style={{ ...styles.input, width: '100%', maxWidth: 480 }}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          maxLength={200}
          placeholder="Bus 14 is in for repair"
        />
      </Field>

      <div style={{ ...styles.row, marginTop: 12 }}>
        <BusyButton busy={busy} onClick={confirm} disabled={reason.trim().length < 3}>
          Cancel this trip
        </BusyButton>
        <button type="button" onClick={onClose}>
          Keep it
        </button>
      </div>
    </div>
  );
}
