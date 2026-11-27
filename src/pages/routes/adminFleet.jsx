// Admin: buses, and the pattern each route runs on. Owner: Yehia (247330).

import { useEffect, useState } from 'react';
import { newIdempotencyKey, routesApi } from './routesApi';
import {
  Badge,
  BusyButton,
  Card,
  Empty,
  ErrorBanner,
  Field,
  Spinner,
  SuccessNote,
  Table,
  WEEKDAYS,
  styles,
  todayIso,
  useAction,
} from './ui';

export function BusesTab() {
  const [buses, setBuses] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [done, setDone] = useState('');
  const [form, setForm] = useState({ plate_number: '', capacity: 40, supervisor_id: '' });
  const { busy, error, setError, run } = useAction();

  async function load() {
    try {
      const data = await routesApi('/api/buses');
      setBuses(data.items);
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setDone('');
    if (form.plate_number.trim().length < 3) {
      setError(new Error('Plate number must be at least 3 characters.'));
      return;
    }

    const created = await run(() =>
      routesApi('/api/buses', {
        method: 'POST',
        body: {
          plate_number: form.plate_number,
          capacity: Number(form.capacity),
          // An empty box means "not assigned". Sending "" would fail the id
          // check, so it has to become null.
          supervisor_id: form.supervisor_id.trim() || null,
        },
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      })
    );
    if (created) {
      setForm({ plate_number: '', capacity: 40, supervisor_id: '' });
      setDone(`Bus ${created.plate_number} added.`);
      load();
    }
  }

  return (
    <div style={styles.stack}>
      <Card title="Add a bus">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <SuccessNote onDismiss={() => setDone('')}>{done}</SuccessNote>

        <form onSubmit={submit} className="form-grid">
          <Field label="Plate number">
            <input
              className="input"
              value={form.plate_number}
              onChange={(event) => setForm({ ...form, plate_number: event.target.value })}
              maxLength={20}
            />
          </Field>
          <Field label="Capacity">
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            />
          </Field>
          <Field
            label="Supervisor id (optional)"
            hint="From Ahmed's Users table. The API checks the account is a supervisor."
          >
            <input
              className="input"
              value={form.supervisor_id}
              onChange={(event) => setForm({ ...form, supervisor_id: event.target.value })}
            />
          </Field>
          <BusyButton busy={busy} primary type="submit">
            Add bus
          </BusyButton>
        </form>
      </Card>

      <Card title="Buses">
        <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
        {!buses && !loadError && <Spinner>Loading buses...</Spinner>}
        {buses && buses.length === 0 && <Empty>No buses yet.</Empty>}
        {buses && buses.length > 0 && (
          <Table head={['Plate', 'Capacity', 'Route', 'Supervisor']}>
            {buses.map((bus) => (
              <tr key={bus.id}>
                <td>{bus.plate_number}</td>
                <td>{bus.capacity}</td>
                <td>{bus.route_code || <span className="muted">unassigned</span>}</td>
                <td className="muted">{bus.supervisor_id || 'none'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/**
 * The pattern a route runs on.
 *
 * This is what makes trips something the system produces rather than
 * something an admin types in by hand. Saved once per route per run type;
 * the Trips tab expands it.
 */
export function ScheduleTab({ routes }) {
  const [routeId, setRouteId] = useState('');
  const [schedules, setSchedules] = useState(null);
  const [buses, setBuses] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [done, setDone] = useState('');
  const { busy, error, setError, run } = useAction();

  const [form, setForm] = useState({
    run_type: 'morning',
    // Sunday to Thursday, the normal Egyptian school week, in the ISO
    // numbering the API uses (1 = Monday ... 7 = Sunday).
    days_of_week: [7, 1, 2, 3, 4],
    bus_id: '',
    active_from: todayIso(),
    active_to: '',
  });

  useEffect(() => {
    routesApi('/api/buses')
      .then((data) => setBuses(data.items))
      .catch(() => setBuses([]));
  }, []);

  useEffect(() => {
    if (!routeId) {
      setSchedules(null);
      return;
    }
    routesApi(`/api/routes/${routeId}/schedule`)
      .then((data) => {
        setSchedules(data.items);
        setLoadError(null);
      })
      .catch(setLoadError);
  }, [routeId]);

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      days_of_week: current.days_of_week.includes(day)
        ? current.days_of_week.filter((value) => value !== day)
        : [...current.days_of_week, day].sort((a, b) => a - b),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setDone('');
    if (form.days_of_week.length === 0) {
      setError(new Error('Choose at least one service day.'));
      return;
    }

    const saved = await run(() =>
      routesApi(`/api/routes/${routeId}/schedule`, {
        method: 'PUT',
        body: {
          run_type: form.run_type,
          days_of_week: form.days_of_week,
          bus_id: form.bus_id || null,
          active_from: form.active_from,
          active_to: form.active_to || null,
        },
      })
    );
    if (saved) {
      setDone(`Pattern saved for the ${form.run_type} run.`);
      const data = await routesApi(`/api/routes/${routeId}/schedule`);
      setSchedules(data.items);
    }
  }

  return (
    <div style={styles.stack}>
      <Card title="Choose a route">
        <Field label="Route">
          <select
            className="select"
            value={routeId}
            onChange={(event) => setRouteId(event.target.value)}
          >
            <option value="">Choose a route...</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.code} — {route.name}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />

      {routeId && (
        <>
          <Card title="Current pattern">
            {!schedules && <Spinner>Loading...</Spinner>}
            {schedules && schedules.length === 0 && (
              <Empty>No pattern yet, so nothing will be generated for this route.</Empty>
            )}
            {schedules?.map((schedule) => (
              <div key={schedule.id} style={styles.tight}>
                <Badge tone="good">{schedule.run_type}</Badge>
                <span>
                  {schedule.days_of_week
                    .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.label)
                    .join(', ')}
                </span>
                <span className="muted">
                  from {schedule.active_from}
                  {schedule.active_to ? ` to ${schedule.active_to}` : ' (no end date)'}
                </span>
              </div>
            ))}
          </Card>

          <Card title="Set the pattern">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
            <SuccessNote onDismiss={() => setDone('')}>{done}</SuccessNote>

            <form onSubmit={submit}>
              <div className="form-grid">
                <Field label="Run">
                  <select
                    className="select"
                    value={form.run_type}
                    onChange={(event) => setForm({ ...form, run_type: event.target.value })}
                  >
                    <option value="morning">morning</option>
                    <option value="afternoon">afternoon</option>
                  </select>
                </Field>
                <Field label="Bus (optional)">
                  <select
                    className="select"
                    value={form.bus_id}
                    onChange={(event) => setForm({ ...form, bus_id: event.target.value })}
                  >
                    <option value="">No bus yet</option>
                    {buses.map((bus) => (
                      <option key={bus.id} value={bus.id}>
                        {bus.plate_number}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="From">
                  <input
                    className="input"
                    type="date"
                    value={form.active_from}
                    onChange={(event) => setForm({ ...form, active_from: event.target.value })}
                  />
                </Field>
                <Field label="To (optional)">
                  <input
                    className="input"
                    type="date"
                    value={form.active_to}
                    onChange={(event) => setForm({ ...form, active_to: event.target.value })}
                  />
                </Field>
              </div>

              <fieldset style={{ marginTop: 14 }}>
                <legend className="field__label">Service days</legend>
                <div style={styles.tight}>
                  {WEEKDAYS.map((weekday) => (
                    <label key={weekday.value} style={styles.tight}>
                      <input
                        type="checkbox"
                        checked={form.days_of_week.includes(weekday.value)}
                        onChange={() => toggleDay(weekday.value)}
                      />
                      {weekday.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <p className="muted">
                One pattern per route per run, so saving replaces the existing one.
              </p>
              <BusyButton busy={busy} primary type="submit">
                Save pattern
              </BusyButton>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
