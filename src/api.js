import { API_URLS } from './config';

// One helper for every call to the APIs (Lab 5 apiRequest, React version).
// service is 'routes' (Yehia), 'schedule' (Ahmed, also login) or 'favorites' (Ali).
//
// Changed 24/11 by Yehia, additions only — existing calls behave exactly as
// before. See the three notes marked ADDED below.
export async function apiRequest(service, path, { method = 'GET', body, headers } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URLS[service]}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // ADDED 1: optional per-call headers. The Route & Stop API accepts
      // Idempotency-Key on creates (so a double click cannot make two routes)
      // and X-Turnstile-Token on writes. Callers that pass nothing are
      // unaffected: spreading undefined adds no keys.
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // ADDED 2: rate limiting. The Route & Stop API answers 429 with a
  // Retry-After header. Without this the user saw "Request failed", which
  // gives them no idea that waiting is the fix.
  if (res.status === 429) {
    const seconds = Number(res.headers.get('Retry-After')) || 30;
    throw buildError(
      `Too many requests. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
      { status: 429, code: 'RATE_LIMITED', retryAfter: seconds }
    );
  }

  if (res.status === 204) return null;

  // ADDED 3: a response that is not JSON no longer crashes with a parser
  // error. A gateway timeout or a Vercel error page is HTML, and res.json()
  // threw "Unexpected token <", which told nobody anything.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw buildError(data?.error?.message || `Request failed (${res.status}).`, {
      status: res.status,
      code: data?.error?.code,
      // Conflicts from the Route & Stop API arrive here, e.g. the list of
      // reasons a trip clashes with the timetable.
      details: data?.error?.details,
      requestId: data?.error?.request_id,
    });
  }
  return data;
}

// The thrown value is still an Error whose .message reads the same as before,
// so any page that only shows err.message keeps working untouched. The extra
// fields are there for callers that want them.
function buildError(message, extra) {
  return Object.assign(new Error(message), extra);
}
