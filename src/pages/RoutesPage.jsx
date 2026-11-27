// Route and Stop page. Owner: Yehia (247330).
//
// Two views behind one page: parents, students and supervisors get search
// and read; admins also get the stop editor, the patterns and trip
// generation.
//
// The view is chosen for convenience only. It is NOT the access control:
// every admin endpoint sits behind requireRole('admin') on the server, so
// an admin view forced open by a parent shows nothing but 403s. Deciding
// permissions in the browser means deciding them somewhere the user
// controls, which is the Lab 3 trust boundary point.

import { useEffect, useState } from 'react';
import { getSession } from '../auth';
import { currentRole, routesApi } from './routes/routesApi';
import AdminView from './routes/AdminView';
import ParentView from './routes/ParentView';
import { Btn, Card, ErrorBanner, Spinner, styles } from './routes/ui';

export default function RoutesPage() {
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  // Lets an admin see exactly what a parent sees, which is the quickest way
  // to check the read-only view during the demo.
  const [asParent, setAsParent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!getSession()) {
        if (!cancelled) {
          setRole('anonymous');
          setChecking(false);
        }
        return;
      }

      // The session saved at login already carries the role, so normally
      // there is nothing to ask. Only if it is missing does the page find
      // out by calling an admin-only endpoint: 200 means admin, 403 means
      // any other signed-in role.
      const stored = currentRole();
      if (stored) {
        if (!cancelled) {
          setRole(stored);
          setChecking(false);
        }
        return;
      }

      try {
        await routesApi('/api/buses');
        if (!cancelled) setRole('admin');
      } catch (caught) {
        if (cancelled) return;
        if (caught.status === 403) setRole('parent');
        else if (caught.status === 401) setRole('anonymous');
        else {
          // A network failure is not a reason to show the wrong view, so
          // fall back to the read-only one and say what happened.
          setRole('parent');
          setError(caught);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) return <Spinner>Checking your access...</Spinner>;

  if (role === 'anonymous') {
    return (
      <section className="wrap">
        <h2 className="section-title">Routes and stops</h2>
        <Card>
          <p>Sign in with your email and password to see the routes.</p>
        </Card>
      </section>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <section className="wrap">
      <div style={styles.row}>
        <h2 className="section-title" style={{ flex: 1, margin: 0 }}>
          Routes and stops
        </h2>
        {isAdmin && (
          <Btn small onClick={() => setAsParent((value) => !value)}>
            {asParent ? 'Back to admin view' : 'View as a parent'}
          </Btn>
        )}
      </div>
      <p className="section-sub">
        {isAdmin && !asParent
          ? 'Plan the routes, their stops, the buses and the runs.'
          : 'Find a route, see its stops in order, and check whether the bus is running.'}
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {isAdmin && !asParent ? <AdminView /> : <ParentView />}
    </section>
  );
}
