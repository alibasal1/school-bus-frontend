// Admin: routes and their stops. Owner: Yehia (247330).

import { useEffect, useState } from 'react';
import { newIdempotencyKey, routesApi } from './routesApi';
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
  styles,
  useAction,
} from './ui';

export function RoutesTab({ routes, loading, error, reload }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div style={styles.stack}>
      <CreateRouteForm onCreated={reload} />

      <ErrorBanner error={error} />
      {loading && <Spinner>Loading routes...</Spinner>}
      {!loading && routes.length === 0 && <Empty>No routes yet. Add the first one above.</Empty>}

      {routes.map((route) => (
        <RouteRow
          key={route.id}
          route={route}
          open={route.id === openId}
          onToggle={() => setOpenId(route.id === openId ? null : route.id)}
          reload={reload}
        />
      ))}
    </div>
  );
}

function CreateRouteForm({ onCreated }) {
  const [form, setForm] = useState({ code: '', name: '', area: '' });
  const [done, setDone] = useState('');
  const { busy, error, setError, run } = useAction();

  // One key per attempt by the user, not per request. If the first submit
  // times out and they press the button again, the same key goes up and the
  // API replays its answer instead of creating a second route. A new key is
  // taken only once a create has actually succeeded.
  const [key, setKey] = useState(newIdempotencyKey);

  function validate() {
    if (form.code.trim().length < 2) return 'Code must be at least 2 characters.';
    if (form.name.trim().length < 3) return 'Name must be at least 3 characters.';
    if (form.area.trim().length < 2) return 'Area must be at least 2 characters.';
    return null;
  }

  async function submit(event) {
    event.preventDefault();
    setDone('');
    const problem = validate();
    if (problem) {
      setError(new Error(problem));
      return;
    }

    const created = await run(() =>
      routesApi('/api/routes', {
        method: 'POST',
        body: form,
        headers: { 'Idempotency-Key': key },
      })
    );
    if (created) {
      setForm({ code: '', name: '', area: '' });
      setKey(newIdempotencyKey());
      setDone(`Route ${created.code} added.`);
      onCreated();
    }
  }

  return (
    <Card title="Add a route">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessNote onDismiss={() => setDone('')}>{done}</SuccessNote>

      <form onSubmit={submit} className="form-grid">
        <Field label="Code" hint="For example R3.">
          <input
            className="input"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            maxLength={20}
          />
        </Field>
        <Field label="Name">
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={100}
          />
        </Field>
        <Field label="Area">
          <input
            className="input"
            value={form.area}
            onChange={(event) => setForm({ ...form, area: event.target.value })}
            maxLength={100}
          />
        </Field>
        <BusyButton busy={busy} primary type="submit">
          Add route
        </BusyButton>
      </form>

      <p className="muted">
        The browser checks these, but only the API decides: it validates every field again,
        because anyone can skip this form and call the API directly.
      </p>
    </Card>
  );
}

function RouteRow({ route, open, onToggle, reload }) {
  const [editing, setEditing] = useState(false);
  const { busy, error, setError, run } = useAction();

  async function setActive(isActive) {
    const updated = await run(() =>
      routesApi(`/api/routes/${route.id}`, { method: 'PUT', body: { is_active: isActive } })
    );
    if (updated) reload();
  }

  async function remove() {
    // The API refuses to delete a route that has trips and says to
    // deactivate instead. That 409 is shown in full rather than turned into
    // "could not delete", because the message contains the way forward.
    const deleted = await run(async () => {
      await routesApi(`/api/routes/${route.id}`, { method: 'DELETE' });
      return true;
    });
    if (deleted) reload();
  }

  return (
    <Card
      title={`${route.code} — ${route.name}`}
      actions={
        <>
          <Btn small onClick={onToggle}>
            {open ? 'Close' : 'Stops'}
          </Btn>
          <Btn small onClick={() => setEditing((value) => !value)}>
            {editing ? 'Cancel' : 'Rename'}
          </Btn>
          <BusyButton small busy={busy} onClick={() => setActive(!route.is_active)}>
            {route.is_active ? 'Retire' : 'Reactivate'}
          </BusyButton>
          <BusyButton small busy={busy} danger onClick={remove}>
            Delete
          </BusyButton>
        </>
      }
    >
      <div style={styles.tight}>
        <Badge>{route.area}</Badge>
        <Badge tone={route.stop_count > 0 ? 'neutral' : 'warn'}>{route.stop_count} stops</Badge>
        <Badge tone={route.is_active ? 'good' : 'bad'}>
          {route.is_active ? 'Active' : 'Retired'}
        </Badge>
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
    </Card>
  );
}

function EditRouteForm({ route, onSaved }) {
  const [form, setForm] = useState({ code: route.code, name: route.name, area: route.area });
  const { busy, error, setError, run } = useAction();

  async function submit(event) {
    event.preventDefault();
    const saved = await run(() =>
      routesApi(`/api/routes/${route.id}`, { method: 'PUT', body: form })
    );
    if (saved) onSaved();
  }

  return (
    <form onSubmit={submit} className="form-grid" style={{ marginTop: 14 }}>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <Field label="Code">
        <input
          className="input"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
      </Field>
      <Field label="Name">
        <input
          className="input"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="Area">
        <input
          className="input"
          value={form.area}
          onChange={(event) => setForm({ ...form, area: event.target.value })}
        />
      </Field>
      <BusyButton busy={busy} primary type="submit">
        Save
      </BusyButton>
    </form>
  );
}

/**
 * Add, rename, delete and reorder the stops of one route.
 *
 * Note what the reorder buttons send: `{ move: { stop_id, to_position } }`,
 * never a stop_order on the stop itself, which the API refuses outright.
 * Positions belong to the server, because it is the only place that can
 * renumber the whole route in one transaction. Two admins dragging stops at
 * once would otherwise leave a gap or a duplicate, and "your stop is 4th"
 * would stop meaning anything.
 */
function StopEditor({ routeId, onChanged }) {
  const [stops, setStops] = useState(null);
  const [newStop, setNewStop] = useState({ name: '', landmark: '' });
  const [loadError, setLoadError] = useState(null);
  const { busy, error, setError, run } = useAction();

  async function load() {
    try {
      const route = await routesApi(`/api/routes/${routeId}`);
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
    if (newStop.name.trim().length < 3) {
      setError(new Error('Stop name must be at least 3 characters.'));
      return;
    }
    const created = await run(() =>
      routesApi(`/api/routes/${routeId}/stops`, {
        method: 'POST',
        body: { name: newStop.name, landmark: newStop.landmark || null },
        headers: { 'Idempotency-Key': newIdempotencyKey() },
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
      routesApi(`/api/routes/${routeId}/stops/order`, {
        method: 'PUT',
        body: { move: { stop_id: stop.id, to_position: target } },
      })
    );
    if (result) setStops(result.stops);
  }

  async function removeStop(stop) {
    const done = await run(async () => {
      await routesApi(`/api/stops/${stop.id}`, { method: 'DELETE' });
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
      routesApi(`/api/stops/${stop.id}`, { method: 'PUT', body: { name } })
    );
    if (saved) await load();
  }

  return (
    <div style={{ marginTop: 14 }}>
      <h4 className="section-title">Stops</h4>
      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {!stops && <Spinner>Loading stops...</Spinner>}
      {stops && stops.length === 0 && <Empty>No stops yet.</Empty>}

      {stops && stops.length > 0 && (
        <Table head={['#', 'Name', 'Landmark', 'Order', '']}>
          {stops.map((stop) => (
            <tr key={stop.id}>
              <td>{stop.stop_order}</td>
              <td>
                <input
                  className="input"
                  defaultValue={stop.name}
                  onBlur={(event) => rename(stop, event.target.value.trim())}
                  aria-label={`Name of stop ${stop.stop_order}`}
                />
              </td>
              <td className="muted">{stop.landmark || '—'}</td>
              <td>
                <div style={styles.tight}>
                  <BusyButton
                    small
                    busy={busy}
                    onClick={() => move(stop, -1)}
                    disabled={stop.stop_order === 1}
                    aria-label="Move up"
                  >
                    Up
                  </BusyButton>
                  <BusyButton
                    small
                    busy={busy}
                    onClick={() => move(stop, 1)}
                    disabled={stop.stop_order === stops.length}
                    aria-label="Move down"
                  >
                    Down
                  </BusyButton>
                </div>
              </td>
              <td>
                <BusyButton small danger busy={busy} onClick={() => removeStop(stop)}>
                  Delete
                </BusyButton>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <form onSubmit={addStop} className="form-grid" style={{ marginTop: 14 }}>
        <Field label="New stop">
          <input
            className="input"
            value={newStop.name}
            onChange={(event) => setNewStop({ ...newStop, name: event.target.value })}
            maxLength={100}
          />
        </Field>
        <Field label="Landmark (optional)">
          <input
            className="input"
            value={newStop.landmark}
            onChange={(event) => setNewStop({ ...newStop, landmark: event.target.value })}
            maxLength={150}
          />
        </Field>
        <BusyButton busy={busy} primary type="submit">
          Add stop
        </BusyButton>
      </form>

      <p className="muted">
        Deleting a stop closes the gap automatically: the API renumbers the rest in the same
        transaction, so the order is always 1 to n.
      </p>
    </div>
  );
}
