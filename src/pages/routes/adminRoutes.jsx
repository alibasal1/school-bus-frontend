// Admin: routes and their stops. Owner: Yehia.

import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { newIdempotencyKey, turnstileHeaders } from './turnstile';
import {
  Badge,
  Btn,
  BusyButton,
  Empty,
  ErrorBanner,
  Field,
  Spinner,
  styles,
  useAction,
} from './ui';

export function RoutesTab({ routes, loading, error, reload }) {
  const [openId, setOpenId] = useState(null);

  return (
    <section>
      <CreateRouteForm onCreated={reload} />

      <h3>Routes</h3>
      <ErrorBanner error={error} />
      {loading && <Spinner>Loading routes…</Spinner>}
      {!loading && routes.length === 0 && <Empty>No routes yet. Create the first one above.</Empty>}

      {routes.map((route) => (
        <RouteRow
          key={route.id}
          route={route}
          open={route.id === openId}
          onToggle={() => setOpenId(route.id === openId ? null : route.id)}
          reload={reload}
        />
      ))}
    </section>
  );
}

function CreateRouteForm({ onCreated }) {
  const [form, setForm] = useState({ code: '', name: '', area: '' });
  const { busy, error, setError, run } = useAction();

  // One key per attempt by the user, not per request. If the first submit
  // times out and the user presses the button again, the same key goes up
  // and the API replays its answer instead of creating a second route. The
  // key is only replaced once a create has actually succeeded.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  async function submit(event) {
    event.preventDefault();
    const created = await run(() =>
      apiRequest('routes', '/api/routes', {
        method: 'POST',
        body: form,
        headers: { 'Idempotency-Key': idempotencyKey, ...turnstileHeaders() },
      })
    );
    if (created) {
      setForm({ code: '', name: '', area: '' });
      setIdempotencyKey(newIdempotencyKey());
      onCreated();
    }
  }

  return (
    <form onSubmit={submit} style={styles.card}>
      <h3 style={{ marginTop: 0 }}>Add a route</h3>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div style={styles.row}>
        <Field label="Code" hint="2–20 characters, e.g. R-04">
          <input
            style={styles.input}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            maxLength={20}
            required
          />
        </Field>
        <Field label="Name">
          <input
            style={styles.input}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            minLength={3}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Area">
          <input
            style={styles.input}
            value={form.area}
            onChange={(event) => setForm({ ...form, area: event.target.value })}
            minLength={2}
            maxLength={100}
            required
          />
        </Field>
        <BusyButton busy={busy} type="submit">
          Create route
        </BusyButton>
      </div>
      <p style={styles.muted}>
        The browser checks these too, but only the API's answer decides: it validates every field
        again, because anyone can skip this form and call the API directly.
      </p>
    </form>
  );
}

function RouteRow({ route, open, onToggle, reload }) {
  const [editing, setEditing] = useState(false);
  const { busy, error, setError, run } = useAction();

  async function setActive(isActive) {
    const updated = await run(() =>
      apiRequest('routes', `/api/routes/${route.id}`, {
        method: 'PUT',
        body: { is_active: isActive },
        headers: turnstileHeaders(),
      })
    );
    if (updated) reload();
  }

  async function remove() {
    // The API refuses to delete a route that has trips, and says to
    // deactivate instead. That 409 is shown in full rather than turned into
    // "could not delete", because the message contains the way forward.
    const deleted = await run(async () => {
      await apiRequest('routes', `/api/routes/${route.id}`, { method: 'DELETE' });
      return true;
    });
    if (deleted) reload();
  }

  return (
    <article style={styles.card}>
      <div style={styles.row}>
        <strong>{route.code}</strong>
        <span style={{ flex: 1 }}>{route.name}</span>
        <Badge>{route.area}</Badge>
        <Badge tone={route.stop_count > 0 ? 'neutral' : 'warn'}>{route.stop_count} stops</Badge>
        <Badge tone={route.is_active ? 'good' : 'bad'}>
          {route.is_active ? 'Active' : 'Retired'}
        </Badge>
        <Btn onClick={onToggle}>
          {open ? 'Close' : 'Stops'}
        </Btn>
        <Btn onClick={() => setEditing((value) => !value)}>
          {editing ? 'Cancel' : 'Rename'}
        </Btn>
        <BusyButton busy={busy} onClick={() => setActive(!route.is_active)}>
          {route.is_active ? 'Retire' : 'Reactivate'}
        </BusyButton>
        <BusyButton busy={busy} onClick={remove}>
          Delete
        </BusyButton>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {editing && (
        <EditRouteForm
          route={route}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}

      {open && <StopEditor routeId={route.id} onChanged={reload} />}
    </article>
  );
}

function EditRouteForm({ route, onSaved }) {
  const [form, setForm] = useState({ code: route.code, name: route.name, area: route.area });
  const { busy, error, setError, run } = useAction();

  async function submit(event) {
    event.preventDefault();
    const saved = await run(() =>
      apiRequest('routes', `/api/routes/${route.id}`, {
        method: 'PUT',
        body: form,
        headers: turnstileHeaders(),
      })
    );
    if (saved) onSaved();
  }

  return (
    <form onSubmit={submit} style={{ ...styles.row, marginTop: 8 }}>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <Field label="Code">
        <input
          style={styles.input}
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
      </Field>
      <Field label="Name">
        <input
          style={styles.input}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="Area">
        <input
          style={styles.input}
          value={form.area}
          onChange={(event) => setForm({ ...form, area: event.target.value })}
        />
      </Field>
      <BusyButton busy={busy} type="submit">
        Save
      </BusyButton>
    </form>
  );
}

/**
 * Add, rename, delete and reorder the stops of one route.
 *
 * Note what the reorder buttons send: `{ move: { stop_id, to_position } }`,
 * not a new stop_order on the stop itself. The API refuses stop_order on the
 * stop endpoint entirely. Positions are the server's to decide, because it
 * is the only place that can renumber the whole route in one transaction —
 * two admins dragging stops at the same time would otherwise leave the
 * sequence with a gap or a duplicate, and "your stop is 4th" would stop
 * meaning anything.
 */
function StopEditor({ routeId, onChanged }) {
  const [stops, setStops] = useState(null);
  const [newStop, setNewStop] = useState({ name: '', landmark: '' });
  const { busy, error, setError, run } = useAction();
  const [loadError, setLoadError] = useState(null);

  async function load() {
    try {
      const route = await apiRequest('routes', `/api/routes/${routeId}`);
      setStops(route.stops);
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  async function addStop(event) {
    event.preventDefault();
    const created = await run(() =>
      apiRequest('routes', `/api/routes/${routeId}/stops`, {
        method: 'POST',
        body: { name: newStop.name, landmark: newStop.landmark || null },
        headers: { 'Idempotency-Key': newIdempotencyKey(), ...turnstileHeaders() },
      })
    );
    if (created) {
      setNewStop({ name: '', landmark: '' });
      await load();
      onChanged();
    }
  }

  async function move(stop, direction) {
    const target = stop.stop_order + direction;
    if (target < 1 || target > stops.length) return;
    const result = await run(() =>
      apiRequest('routes', `/api/routes/${routeId}/stops/order`, {
        method: 'PUT',
        body: { move: { stop_id: stop.id, to_position: target } },
      })
    );
    if (result) setStops(result.stops);
  }

  async function removeStop(stop) {
    const done = await run(async () => {
      await apiRequest('routes', `/api/stops/${stop.id}`, { method: 'DELETE' });
      return true;
    });
    if (done) {
      await load();
      onChanged();
    }
  }

  async function rename(stop, name) {
    if (!name || name === stop.name) return;
    const saved = await run(() =>
      apiRequest('routes', `/api/stops/${stop.id}`, {
        method: 'PUT',
        body: { name },
        headers: turnstileHeaders(),
      })
    );
    if (saved) await load();
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <h4 style={{ marginTop: 0 }}>Stops</h4>
      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!stops && <Spinner>Loading stops…</Spinner>}
      {stops && stops.length === 0 && <Empty>No stops yet.</Empty>}

      {stops && stops.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Landmark</th>
              <th style={styles.th}>Order</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {stops.map((stop) => (
              <tr key={stop.id}>
                <td style={styles.td}>{stop.stop_order}</td>
                <td style={styles.td}>
                  <input
                    style={styles.input}
                    defaultValue={stop.name}
                    onBlur={(event) => rename(stop, event.target.value.trim())}
                    aria-label={`Name of stop ${stop.stop_order}`}
                  />
                </td>
                <td style={styles.td}>{stop.landmark || <span style={styles.muted}>—</span>}</td>
                <td style={styles.td}>
                  <BusyButton
                    busy={busy}
                    onClick={() => move(stop, -1)}
                    disabled={stop.stop_order === 1}
                    aria-label="Move up"
                  >
                    ↑
                  </BusyButton>{' '}
                  <BusyButton
                    busy={busy}
                    onClick={() => move(stop, 1)}
                    disabled={stop.stop_order === stops.length}
                    aria-label="Move down"
                  >
                    ↓
                  </BusyButton>
                </td>
                <td style={styles.td}>
                  <BusyButton busy={busy} onClick={() => removeStop(stop)}>
                    Delete
                  </BusyButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={addStop} style={{ ...styles.row, marginTop: 8 }}>
        <Field label="New stop">
          <input
            style={styles.input}
            value={newStop.name}
            onChange={(event) => setNewStop({ ...newStop, name: event.target.value })}
            minLength={3}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Landmark (optional)">
          <input
            style={styles.input}
            value={newStop.landmark}
            onChange={(event) => setNewStop({ ...newStop, landmark: event.target.value })}
            maxLength={150}
          />
        </Field>
        <BusyButton busy={busy} type="submit">
          Add stop
        </BusyButton>
      </form>
      <p style={styles.muted}>
        Deleting a stop closes the gap automatically: the API renumbers the rest in the same
        transaction, so the order is always 1…n.
      </p>
    </div>
  );
}
