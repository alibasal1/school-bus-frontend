// Route & Stop page. Owner: Yehia.
//
// Two views behind one tab: parents, students and supervisors get search and
// read; admins additionally get the stop editor, the schedule patterns and
// trip generation.
//
// The view is chosen for convenience only. It is NOT the access control:
// every admin endpoint is behind requireRole('admin') on the server, so a
// parent who forces the admin view sees nothing but 403s. Deciding
// permissions in the browser would mean deciding them in a place the user
// controls — the point the Lab 3 trust boundary makes.

import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import AdminView from './routes/AdminView';
import ParentView from './routes/ParentView';
import { ErrorBanner, Spinner, styles } from './routes/ui';

export default function RoutesPage() {
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  // Lets an admin look at exactly what a parent sees, which is the quickest
  // way to check the read-only view during the demo.
  const [asParent, setAsParent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!cancelled) {
          setRole('anonymous');
          setChecking(false);
        }
        return;
      }

      // Ahmed's login will store the role next to the token. Until it does,
      // the role is worked out by asking the API: /api/buses is admin-only,
      // so a 200 means admin and a 403 means any other signed-in role.
      // The token itself is opaque to this page by design — a role read out
      // of a token in the browser is a claim, not a fact.
      const stored = localStorage.getItem('role');
      if (stored) {
        if (!cancelled) {
          setRole(stored);
          setChecking(false);
        }
        return;
      }

      try {
        await apiRequest('routes', '/api/buses');
        if (!cancelled) setRole('admin');
      } catch (caught) {
        if (cancelled) return;
        if (caught.status === 403) {
          setRole('parent');
        } else if (caught.status === 401) {
          setRole('anonymous');
        } else {
          // A network failure or a 500 is not a reason to show the wrong
          // view, so fall back to the read-only one and say what happened.
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

  if (checking) return <Spinner>Checking your access…</Spinner>;

  if (role === 'anonymous') {
    return (
      <section>
        <h2>Route &amp; Stop</h2>
        <p>Please log in to see the routes.</p>
        <p style={styles.muted}>
          Log in on the Login tab. While that page is still being built, a token from Postman can
          be put in place with{' '}
          <code>localStorage.setItem(&apos;token&apos;, &apos;…&apos;)</code> in the browser
          console, then reload.
        </p>
      </section>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <section>
      <div style={styles.row}>
        <h2 style={{ flex: 1, margin: 0 }}>Route &amp; Stop</h2>
        {isAdmin && (
          <label style={{ ...styles.row, gap: 4, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={asParent}
              onChange={(event) => setAsParent(event.target.checked)}
            />
            View as a parent
          </label>
        )}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {isAdmin && !asParent ? <AdminView /> : <ParentView />}
    </section>
  );
}
