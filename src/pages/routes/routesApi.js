// Calls to the Route & Stop API. Owner: Yehia (247330).
//
// My service has its own API Gateway on Floci (VITE_ROUTES_API_URL). The
// shared api.js sends everything to Ahmed's gateway, which has no
// /api/routes routes, so this page calls my API directly with the same
// signed-in session token. Sessions live in the shared Sessions table, so
// my API accepts a token Ahmed's login issued.
//
// Without the variable it falls back to the shared apiRequest, so the page
// still works in a local setup that proxies everything through one address.
//
// Same pattern as Ali uses in FavoritesPage.jsx, on purpose: one way of
// doing this across the app is easier to follow than three.
//
// Set it in .env.local, which is not committed:
//   VITE_ROUTES_API_URL=http://<api-id>.execute-api.localhost.floci.io:4566

import { apiRequest } from '../../api';
import { getSession } from '../../auth';

const MY_API = (import.meta.env.VITE_ROUTES_API_URL || '').replace(/\/$/, '');

export async function routesApi(path, { method = 'GET', body, headers } = {}) {
  if (!MY_API) return apiRequest('routes', path, { method, body, headers });

  const session = getSession();
  if (!session) {
    throw Object.assign(new Error('Sign in with your email and password to continue.'), {
      status: 401,
    });
  }

  const res = await fetch(`${MY_API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.token}`,
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // The API answers 429 with Retry-After. Saying how long to wait is more
  // use than "request failed".
  if (res.status === 429) {
    const seconds = Number(res.headers.get('Retry-After')) || 30;
    throw Object.assign(
      new Error(`Too many requests. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`),
      { status: 429, code: 'RATE_LIMITED' }
    );
  }

  if (res.status === 204) return null;

  // A gateway error page is HTML, and res.json() would throw
  // "Unexpected token <", which tells nobody anything.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw Object.assign(new Error(data?.error?.message || `Request failed (${res.status}).`), {
      status: res.status,
      code: data?.error?.code,
      // A 409 from the trips endpoints carries the list of reasons the
      // timetable refused the change. The page shows them.
      details: data?.error?.details,
      requestId: data?.error?.request_id,
    });
  }
  return data;
}

/** The signed-in user's role, or null when nobody is signed in. */
export function currentRole() {
  const session = getSession();
  return session?.user?.role || session?.role || null;
}

/** A fresh Idempotency-Key, so a double click cannot create two routes. */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
