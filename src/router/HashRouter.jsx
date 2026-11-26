import React, { useEffect, useState } from 'react';

/**
 * Simple hash‑based router.
 * Props:
 *  - routes: [{ path: string, element: ReactNode }]
 *  - defaultPath: string – path to navigate to when hash is empty.
 */
export default function HashRouter({ routes, defaultPath = '/' }) {
  const [currentPath, setCurrentPath] = useState(
    // Strip leading '#'
    window.location.hash.replace(/^#/, '') || defaultPath
  );

  useEffect(() => {
    const onHashChange = () => {
      const newPath = window.location.hash.replace(/^#/, '') || defaultPath;
      setCurrentPath(newPath);
    };
    window.addEventListener('hashchange', onHashChange);
    // Ensure default on first load if no hash
    if (!window.location.hash) {
      window.location.hash = `#${defaultPath}`;
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [defaultPath]);

  const match = routes.find(r => r.path === currentPath);
  if (match) {
    return <>{match.element}</>;
  }
  // fallback: try wildcard '*'
  const wildcard = routes.find(r => r.path === '*');
  return wildcard ? <>{wildcard.element}</> : null;
}
