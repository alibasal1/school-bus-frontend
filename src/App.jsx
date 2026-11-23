import { useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RoutesPage from './pages/RoutesPage';
import SchedulePage from './pages/SchedulePage';
import FavoritesPage from './pages/FavoritesPage';
import AlertsPage from './pages/AlertsPage';

// Dashboard shell: a sidebar, a top bar and one page in the middle.
// Still tabs rather than a router, so there is nothing extra to learn and no
// new dependency — the page is chosen by state, exactly as before. Only the
// surroundings changed.
//
// Every page component is imported and rendered exactly as it was, so nobody
// needs to touch their own page to fit the new look: the styling lives in
// src/styles/theme.css and applies to plain HTML elements.

const NAV = [
  {
    group: null,
    items: [{ key: 'dashboard', label: 'Dashboard', icon: '▦' }],
  },
  {
    group: 'Planning',
    items: [
      { key: 'routes', label: 'Routes & stops', icon: '⛬' },
      { key: 'schedule', label: 'Bus times', icon: '◷' },
    ],
  },
  {
    group: 'For families',
    items: [
      { key: 'favorites', label: 'My stops', icon: '★' },
      { key: 'alerts', label: 'Alerts', icon: '!' },
    ],
  },
  {
    group: 'Account',
    items: [{ key: 'login', label: 'Login', icon: '◉' }],
  },
];

const PAGES = {
  dashboard: { label: 'Dashboard', Page: DashboardPage },
  routes: { label: 'Routes & stops', Page: RoutesPage },
  schedule: { label: 'Bus times', Page: SchedulePage },
  favorites: { label: 'My stops', Page: FavoritesPage },
  alerts: { label: 'Alerts', Page: AlertsPage },
  login: { label: 'Login', Page: LoginPage },
};

export default function App() {
  const [current, setCurrent] = useState('dashboard');
  const { Page, label } = PAGES[current];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <BusMark />
          </span>
          School Bus
        </div>

        {NAV.map((section) => (
          <div key={section.group ?? 'top'}>
            {section.group && <div className="nav-group">{section.group}</div>}
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className="nav-item"
                onClick={() => setCurrent(item.key)}
                disabled={item.key === current}
                aria-current={item.key === current ? 'page' : undefined}
              >
                <span aria-hidden="true" style={{ width: 16, textAlign: 'center', opacity: 0.8 }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <strong style={{ color: 'var(--text-primary)' }}>Team 14</strong>
          <p style={{ margin: '6px 0 0' }}>
            Route &amp; Stop · Schedule &amp; Arrival · Favorites &amp; Alerts
          </p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="crumb">
            School Bus / <strong>{label}</strong>
          </span>
          <div className="topbar-spacer" />
          <div className="avatar" title="Signed-in user" aria-hidden="true">
            ●
          </div>
        </header>

        <main className="content">
          {/* onNavigate lets the dashboard's buttons move between pages.
              Pages that do not take it simply ignore the prop. */}
          <Page onNavigate={setCurrent} />
        </main>
      </div>
    </div>
  );
}

/** A plain bus shape, drawn here so the app needs no image file. */
function BusMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="2" fill="#fff" />
      <rect x="3.5" y="4.6" width="3.6" height="2.6" rx="0.6" fill="#f0531f" />
      <rect x="8.9" y="4.6" width="3.6" height="2.6" rx="0.6" fill="#f0531f" />
      <circle cx="5" cy="12.4" r="1.5" fill="#fff" />
      <circle cx="11" cy="12.4" r="1.5" fill="#fff" />
    </svg>
  );
}
