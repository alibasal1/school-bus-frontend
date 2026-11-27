// What an admin sees. Owner: Yehia (247330).
//
// Four tabs, in the order the work is actually done: create the routes and
// their stops, add the buses, say when each route runs, then generate and
// manage the trips.

import { useCallback, useEffect, useState } from 'react';
import { asList, routesApi } from './routesApi';
import { RoutesTab } from './adminRoutes';
import { BusesTab, ScheduleTab } from './adminFleet';
import { TripsTab } from './adminTrips';
import { Tabs } from './ui';

const TABS = [
  { key: 'routes', label: 'Routes and stops' },
  { key: 'buses', label: 'Buses' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'trips', label: 'Trips' },
];

export default function AdminView() {
  const [tab, setTab] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Loaded once here rather than in each tab: three of the four need the
  // same list, and two only need it to fill a dropdown. include_inactive is
  // admin-only on the API, and a retired route still has to be editable,
  // which is the whole point of retiring instead of deleting.
  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await routesApi('/api/routes?limit=100&include_inactive=true');
      setRoutes(asList(data));
      setError(null);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  return (
    <div>
      <Tabs tabs={TABS} current={tab} onChange={setTab} />

      {tab === 'routes' && (
        <RoutesTab routes={routes} loading={loading} error={error} reload={loadRoutes} />
      )}
      {tab === 'buses' && <BusesTab />}
      {tab === 'schedule' && <ScheduleTab routes={routes} />}
      {tab === 'trips' && <TripsTab routes={routes} />}
    </div>
  );
}
