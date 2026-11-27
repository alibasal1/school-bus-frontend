import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import SchedulePage from './pages/SchedulePage';
import RoutesPage from './pages/RoutesPage.jsx';
import AlertsPage from './pages/AlertsPage';
import FavoritesPage from './pages/FavoritesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HashRouter from './router/HashRouter';

function NavBar() {
  const [activePath, setActivePath] = React.useState(window.location.hash.replace('#', '') || '/schedule');
  React.useEffect(() => {
    const onHashChange = () => {
      setActivePath(window.location.hash.replace('#', '') || '/schedule');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const link = (to, label) => (
    <a href={`#${to}`} className={`nav-tab ${activePath === to ? 'is-active' : ''}`} style={{ textDecoration: 'none' }}>
      {label}
    </a>
  );

  return (
    <nav className="topbar wrap" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      {link('/schedule', 'Schedule')}
      {link('/routes', 'Routes')}
      {link('/alerts', 'Alerts')}
      {link('/favorites', 'Favorites')}
      {link('/login', 'Login')}
      {link('/signup', 'Signup')}
    </nav>
  );
}

function App() {
  const routes = [
    { path: '/', element: <SchedulePage /> },
    { path: '/routes', element: <RoutesPage /> },
    { path: '/schedule', element: <SchedulePage /> },
    { path: '/alerts', element: <AlertsPage /> },
    { path: '/favorites', element: <FavoritesPage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/signup', element: <SignupPage /> },
    { path: '*', element: <h2>Page not found</h2> },
  ];

  return (
    <>
      <NavBar />
  <HashRouter routes={routes} defaultPath="/schedule" />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

