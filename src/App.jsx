import { useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RoutesPage from './pages/RoutesPage';
import SchedulePage from './pages/SchedulePage';
import FavoritesPage from './pages/FavoritesPage';
import AlertsPage from './pages/AlertsPage';

// Tabs, chosen by state. No router and no new dependency.
//
// Styling is React styles only: no .css file and no global stylesheet, so
// nothing here changes how anyone else's page looks from a distance. The
// colours are the ones Ali uses in FavoritesPage and AlertsPage, so the two
// halves of the app look like one app.
//
// The nav buttons carry an explicit colour AND background. That is the fix
// for the unreadable buttons on Windows: Chrome there draws a light grey
// button face, so a button with no colour of its own inherits whatever text
// colour is around it and can end up invisible.

const NAV = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'routes', label: 'Routes & stops' },
  { key: 'schedule', label: 'Bus times' },
  { key: 'favorites', label: 'My stops' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'login', label: 'Login' },
];

const PAGES = {
  dashboard: DashboardPage,
  routes: RoutesPage,
  schedule: SchedulePage,
  favorites: FavoritesPage,
  alerts: AlertsPage,
  login: LoginPage,
};

const NAVY = '#1f3b73';
const TEXT = '#1f2533';
const BORDER = '#e2e6ee';
const PAGE_BG = '#f4f6fa';

const shell = {
  // The page background is set here rather than in index.html, so it stays
  // inside React as agreed.
  outer: {
    minHeight: '100vh',
    background: PAGE_BG,
    color: TEXT,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 16,
  },
  inner: { maxWidth: 1000, margin: '0 auto', padding: '24px 20px 60px' },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: TEXT },
  nav: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 },
};

function navButtonStyle(isCurrent) {
  return {
    font: 'inherit',
    fontSize: 15,
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    background: isCurrent ? NAVY : '#ffffff',
    color: isCurrent ? '#ffffff' : TEXT,
    border: `1px solid ${isCurrent ? NAVY : BORDER}`,
    fontWeight: isCurrent ? 600 : 400,
  };
}

export default function App() {
  const [current, setCurrent] = useState('dashboard');
  const Page = PAGES[current];

  return (
    <div style={shell.outer}>
      <div style={shell.inner}>
        <header style={shell.header}>
          <h1 style={shell.title}>School Bus Route Tracker</h1>
        </header>

        <nav style={shell.nav}>
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCurrent(item.key)}
              aria-current={item.key === current ? 'page' : undefined}
              style={navButtonStyle(item.key === current)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* onNavigate lets the dashboard's buttons move between pages.
            Pages that do not take it simply ignore the prop, so none of the
            other pages needed changing. */}
        <Page onNavigate={setCurrent} />
      </div>
    </div>
  );
}
