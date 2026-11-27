// Admin: generating trips, and cancelling them. Owner: Yehia (247330).
//
// The two screens the project is really about. Neither is a form that
// writes a row: generation asks the server what should exist and shows its
// reasoning before anything is written, and cancelling shows who it affects
// before it happens and then tells them.

import { useCallback, useEffect, useState } from 'react';
import { asList, newIdempotencyKey, routesApi } from './routesApi';
import {
  Badge,
  Btn,
  BusyButton,
  Card,
  Empty,
  ErrorBanner,
  Field,
  Spinner,
  SuccessNote,
  Table,
  formatIsoDate,
  styles,
  todayIso,
  useAction,
} from './ui';

// The server's skip codes, in words. Shown instead of the raw code, so the
// preview explains itself: a shorter list with no reasons looks like a bug.
const SKIP_LABELS = {
  trip_already_exists: 'This run already exists',
  route_missing: 'The route no longer exists',
  conflict: 'Clashes with the timetable',
};

export function TripsTab({ routes }) {
  const [token, setToken] = useState(0);
  const refresh = useCallback(() => setToken((value) => value + 1), []);

  return (
    <div style={styles.stack}>
      <GeneratePanel routes={routes} onCommitted={refresh} />
      <TripList routes={routes} refreshToken={token} onChanged={refresh} />
    </div>
  );
}

/**
 * Preview, then commit.
 *
 * The API defaults to a preview and only writes when dry_run is explicitly
 * false, so sending the same request without the flag is harmless. The same
 * Idempotency-Key is reused for the commit that follows a preview, so
 * pressing Create twice cannot produce two sets of trips.
 */
function GeneratePanel({ routes, onCommitted }) {
  const [routeId, setRouteId] = useState('');
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);
  const { busy, error, setError, run } = useAction();

  async function doPreview() {
    setDone('');
    const result = await run(() =>
      routesApi('/api/trips/generate', {
        method: 'POST',
        body: { route_id: routeId || null, dry_run: true },
      })
    );
    if (result) setPreview(result);
  }

  async function doCommit() {
    const result = await run(() =>
      routesApi('/api/trips/generate', {
        method: 'POST',
        body: { route_id: routeId || null, dry_run: false },
        headers: { 'Idempotency-Key': key },
      })
    );
    if (result) {
      setPreview(null);
      setKey(newIdempotencyKey());
      setDone(`${result.created} trip${result.created === 1 ? '' : 's'} created.`);
      onCommitted();
    }
  }

  return (
    <Card
      title="Generate trips from the saved patterns"
      actions={
        <BusyButton busy={busy} primary onClick={doPreview}>
          Preview
        </BusyButton>
      }
    >
      <p className="muted">
        Works out which runs each route should have from its saved pattern, skips the ones that
        already exist, and refuses anything that would double-book a bus or a supervisor. Nothing
        is written until you press Create.
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessNote onDismiss={() => setDone('')}>{done}</SuccessNote>

      <Field label="Route">
        <select
          className="select"
          value={routeId}
          onChange={(event) => setRouteId(event.target.value)}
        >
          <option value="">All routes</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.code}
            </option>
          ))}
        </select>
      </Field>

      {preview && <PreviewResult preview={preview} busy={busy} onCommit={doCommit} routes={routes} />}
    </Card>
  );
}

function PreviewResult({ preview, busy, onCommit, routes }) {
  const { summary, trips, skipped } = preview;
  const byReason = summary.skipped_by_reason || {};
  const codeOf = (id) => routes.find((route) => route.id === id)?.code || id;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={styles.tight}>
        <Badge tone={summary.planned > 0 ? 'good' : 'warn'}>{summary.planned} to create</Badge>
        <Badge>{summary.skipped} skipped</Badge>
        <span className="muted">
          {summary.schedules} pattern{summary.schedules === 1 ? '' : 's'}
        </span>
      </div>

      {summary.schedules === 0 && (
        <Empty>No patterns are saved, so there is nothing to expand. Set one on the Schedule tab first.</Empty>
      )}

      {Object.keys(byReason).length > 0 && (
        <ul className="row-list">
          {Object.entries(byReason).map(([reason, count]) => (
            <li key={reason}>
              {SKIP_LABELS[reason] || reason}: <strong>{count}</strong>
            </li>
          ))}
        </ul>
      )}

      {trips.length > 0 && (
        <Table head={['Route', 'Run']}>
          {trips.map((trip) => (
            <tr key={`${trip.route_id}-${trip.run_type}`}>
              <td>{codeOf(trip.route_id)}</td>
              <td>{trip.run_type}</td>
            </tr>
          ))}
        </Table>
      )}

      {/* Only the clashes are listed one by one. Listing every "already
          exists" row would bury the few that need a decision. */}
      {skipped.some((entry) => entry.reason === 'conflict') && (
        <>
          <h4 className="section-title">Refused because of a clash</h4>
          <ul className="row-list">
            {skipped
              .filter((entry) => entry.reason === 'conflict')
              .map((entry) => (
                <li key={`${entry.route_id}-${entry.run_type}`}>
                  {codeOf(entry.route_id)} ({entry.run_type}):{' '}
                  {entry.conflicts?.map((conflict) => conflict.message).join(' ')}
                </li>
              ))}
          </ul>
        </>
      )}

      <BusyButton busy={busy} primary onClick={onCommit} disabled={summary.planned === 0}>
        Create these {summary.planned} trips
      </BusyButton>
    </div>
  );
}

function TripList({ routes, refreshToken, onChanged }) {
  const [filters, setFilters] = useState({ route_id: '', status: '', run_type: '' });
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ limit: '200' });
      for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
      }
      const data = await routesApi(`/api/trips?${query}`);
      setTrips(asList(data));
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
    <Card title="Trips">
      <div className="form-grid">
        <Field label="Route">
          <select
            className="select"
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
        <Field label="Status">
          <select
            className="select"
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
            className="select"
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

      {!trips && <Spinner>Loading trips...</Spinner>}
      {trips && trips.length === 0 && <Empty>No trips match these filters.</Empty>}

      {trips && trips.length > 0 && (
        <Table head={['Route', 'Run', 'Status', 'Source', '']}>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td>{trip.route_code || trip.route_id}</td>
              <td>{trip.run_type}</td>
              <td>
                {trip.status === 'cancelled' ? (
                  <>
                    <Badge tone="bad">cancelled</Badge>
                    <div className="muted">
                      {trip.cancelled_date ? `${formatIsoDate(trip.cancelled_date)}. ` : ''}
                      {trip.cancellation_reason || ''}
                    </div>
                  </>
                ) : (
                  <Badge tone="good">active</Badge>
                )}
              </td>
              <td className="muted">{trip.source}</td>
              <td>
                {trip.status === 'active' && (
                  <Btn small danger onClick={() => setCancelling(trip)}>
                    Cancel
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </Table>
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
    </Card>
  );
}

/**
 * Cancel a run for one day, after showing who it affects.
 *
 * The impact is fetched first, from a read-only endpoint, so the admin sees
 * the number of families before deciding rather than after. The reason is
 * required by the API, and it is not paperwork: it is the text that reaches
 * the parents through Ali's alerts.
 */
function CancelDialog({ trip, onClose, onDone }) {
  const [impact, setImpact] = useState(null);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayIso());
  const [loadError, setLoadError] = useState(null);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    routesApi(`/api/trips/${encodeURIComponent(trip.id)}/impact`)
      .then(setImpact)
      .catch(setLoadError);
  }, [trip.id]);

  async function confirm() {
    if (reason.trim().length < 3) {
      setError(new Error('Give a reason of at least 3 characters. The parents will see it.'));
      return;
    }
    const result = await run(() =>
      routesApi(`/api/trips/${encodeURIComponent(trip.id)}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled', reason: reason.trim(), date },
      })
    );
    if (result) onDone();
  }

  return (
    <Card title={`Cancel ${trip.route_code || trip.route_id}, ${trip.run_type} run`}>
      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!impact && !loadError && <Spinner>Working out who this affects...</Spinner>}

      {impact && (
        <>
          <p>
            <strong>{impact.stop_count}</strong> stop{impact.stop_count === 1 ? '' : 's'} on this
            route
            {impact.affected_students === null ? (
              <span className="muted">
                {' '}
                . The student list is not available, so the number of families cannot be shown.
              </span>
            ) : (
              <>
                {' '}
                . <strong>{impact.affected_students}</strong> student
                {impact.affected_students === 1 ? '' : 's'} and{' '}
                <strong>{impact.affected_parents}</strong> parent
                {impact.affected_parents === 1 ? '' : 's'} will be told.
              </>
            )}
          </p>
          <ul className="row-list">
            {impact.stops.map((stop) => (
              <li key={stop.id}>
                {stop.stop_order}. {stop.name}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="form-grid">
        <Field label="Day to cancel">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="Reason (the parents see this)" hint="3 to 200 characters.">
          <input
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="Bus 14 is in for repair"
          />
        </Field>
      </div>

      <div style={styles.tight}>
        <BusyButton busy={busy} danger onClick={confirm}>
          Cancel this run
        </BusyButton>
        <Btn onClick={onClose}>Keep it</Btn>
      </div>
    </Card>
  );
}
