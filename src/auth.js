import { FLOCI_CONFIG } from './config';

const STORAGE_KEY = 'school_bus_app_session';

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.id) return null;
    if (parsed.expires_at && parsed.expires_at <= Math.floor(Date.now() / 1000)) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  const normalized = {
    ...session,
    displayName: session.user?.name || session.displayName || '',
    role: session.user?.role || session.role || 'parent',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('bus-session-change', { detail: normalized }));
  return normalized;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('bus-session-change', { detail: null }));
}


