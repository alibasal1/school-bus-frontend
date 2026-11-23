// Admin: buses, and the recurring pattern each route runs on. Owner: Yehia.

import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { newIdempotencyKey, turnstileHeaders } from './turnstile';
import {
  Badge,
  BusyButton,
  Empty,
  ErrorBanner,
  Field,
  Spinner,
  WEEKDAYS,
  styles,
  todayIso,
  useAction,
} from './ui';

export function BusesTab() {
  const [buses, setBuses] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ plate_number: '', capacity: 40, supervisor_id: '' });
  const { busy, error, setError, run } = useAction();

  async function load() {
    try {
      const data = await apiRequest('routes', '/api/buses');
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
    const created = await run(() =>
      apiRequest('routes', '/api/buses', {
        method: 'POST',
        body: {
          plate_number: form.plate_number,
          capacity: Number(form.capacity),
          // Empty select means "not assigned". Sending "" would fail the
          // uuid check, so it has to become null.
          supervisor_id: form.supervisor_id.trim() || null,
        },
        headers: { 'Idempotency-Key': newIdempotencyKey(), ...turnstileHeaders() },
      })
    );
    if (created) {
      setForm({ plate_number: '', capacity: 40, supervisor_id: '' });
      load();
    }
  }

  return (
    <section>
      <form onSubmit={submit} style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Add a bus</h3>
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <div style={styles.row}>
          <Field label="Plate number">
            <input
              style={styles.input}
              value={form.plate_number}
              onChange={(event) => setForm({ ...form, plate_number: event.target.value })}
              minLength={3}
              maxLength={20}
              required
            />
          </Field>
          <Field label="Capacity">
            <input
              style={{ ...styles.input, width: 90 }}
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            />
          </Field>
          <Field
            label="Supervisor id (optional)"
            hint="From Ahmed's users table; the API checks the account is a supervisor."
          >
            <input
              style={{ ...styles.input, width: 300 }}
              value={form.supervisor_id}
              onChange={(event) => setForm({ ...form, supervisor_id: event.target.value })}
              placeholder="uuid"
            />
          </Field>
          <BusyButton busy={busy} type="submit">
            Add bus
          </BusyButton>
        </div>
      </form>

      <h3>Buses</h3>
      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
      {!buses && !loadError && <Spinner>Loading buses…</Spinner>}
      {buses && buses.length === 0 && <Empty>No buses yet.</Empty>}
      {buses && buses.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Plate</th>
              <th style={styles.th}>Capacity</th>
              <th style={styles.th}>Route</th>
              <th style={styles.th}>Supervisor</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
              <tr key={bus.id}>
                <td style={styles.td}>{bus.plate_number}</td>
                <td style={styles.td}>{bus.capacity}</td>
                <td style={styles.td}>
                  {bus.route_code || <span style={styles.muted}>unassigned</span>}
                </td>
                <td style={styles.td}>
                  {bus.supervisor_id ? (
                    <code style={{ fontSize: 12 }}>{bus.supervisor_id.slice(0, 8)}…</code>
                  ) : (
                    <span style={styles.muted}>none</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * The recurring pattern a route runs on.
 *
 * This is the piece that makes trips something the system produces rather
 * than something an admin types in 30 times a week. Saved once per route per
 * run type; the Trips tab then expands it over whatever date range is asked
 * for.
 */
export function ScheduleTab({ routes }) {
  const [routeId, setRouteId] = useState('');
  const [schedules, setSchedules] = useState(null);
  const [buses, setBuses] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const { busy, error, setError, run } = useAction();

  const [form, setForm] = useState({
    run_type: 'morning',
    // Sunday to Thursday: the normal Egyptian school week, in the ISO
    // numbering the API uses (1 = Monday … 7 = Sunday).
    days_of_week: [7, 1, 2, 3, 4],
    bus_id: '',
    active_from: todayIso(),
    active_to: '',
  });

  useEffect(() => {
    apiRequest('routes', '/api/buses')
      .then((data) => setBuses(data.items))
      .catch(() => setBuses([]));
  }, []);

  useEffect(() => {
    if (!routeId) {
      setSchedules(null);
      return;
    }
    apiRequest('routes', `/api/routes/${routeId}/schedule`)
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
    const saved = await run(() =>
      apiRequest('routes', `/api/routes/${routeId}/schedule`, {
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
      const data = await apiRequest('routes', `/api/routes/${routeId}/schedule`);
      setSchedules(data.items);
    }
  }

  return (
    <section>
      <Field label="Route">
        <select
          style={styles.input}
          value={routeId}
          onChange={(event) => setRouteId(event.target.value)}
        >
          <option value="">Choose a route…</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.code} — {route.name}
            </option>
          ))}
        </select>
      </Field>

      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />

      {routeId && (
        <>
          <h3>Current pattern</h3>
          {!schedules && <Spinner>Loading…</Spinner>}
          {schedules && schedules.length === 0 && (
            <Empty>No pattern set yet, so nothing will be generated for this route.</Empty>
          )}
          {schedules?.map((schedule) => (
            <div key={schedule.id} style={{ ...styles.card, ...styles.row }}>
              <Badge tone="good">{schedule.run_type}</Badge>
              <span>
                {schedule.days_of_week
                  .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.label)
                  .join(', ')}
              </span>
              <span style={styles.muted}>
                from {schedule.active_from}
                {schedule.active_to ? ` to ${schedule.active_to}` : ' (no end date)'}
              </span>
            </div>
          ))}

          <form onSubmit={submit} style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Set the pattern</h3>
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
            <div style={styles.row}>
              <Field label="Run">
                <select
                  style={styles.input}
                  value={form.run_type}
                  onChange={(event) => setForm({ ...form, run_type: event.target.value })}
                >
                  <option value="morning">morning</option>
                  <option value="afternoon">afternoon</option>
                </select>
              </Field>
              <Field label="Bus (optional)">
                <select
                  style={styles.input}
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
                  style={styles.input}
                  type="date"
                  value={form.active_from}
                  onChange={(event) => setForm({ ...form, active_from: event.target.value })}
                  required
                />
              </Field>
              <Field label="To (optional)">
                <input
                  style={styles.input}
                  type="date"
                  value={form.active_to}
                  onChange={(event) => setForm({ ...form, active_to: event.target.value })}
                />
              </Field>
            </div>

            <fieldset style={{ border: '1px solid #ddd', borderRadius: 4, marginTop: 12 }}>
              <legend style={{ fontSize: 14 }}>Service days</legend>
              <div style={styles.row}>
                {WEEKDAYS.map((weekday) => (
                  <label key={weekday.value} style={{ ...styles.row, gap: 4 }}>
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

            <p style={styles.muted}>
              One pattern per route per run: saving replaces the existing one.
            </p>
            <BusyButton busy={busy} type="submit" disabled={form.days_of_week.length === 0}>
              Save pattern
            </BusyButton>
          </form>
        </>
      )}
    </section>
  );
}
