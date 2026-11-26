import { FLOCI_CONFIG } from './config';
import { getSession } from './auth';

function splitPathAndQuery(path) {
  const idx = path.indexOf('?');
  if (idx === -1) return { cleanPath: path, search: '' };
  return { cleanPath: path.slice(0, idx), search: path.slice(idx) };
}

function resolveBaseUrl() {
  const base = FLOCI_CONFIG.apiGatewayBase.replace(/\/$/, '');
  if (base.startsWith('http://') || base.startsWith('https://')) {
    const parsed = new URL(base);
    return {
      fetchOrigin: parsed.origin,
      basePath: parsed.pathname.replace(/\/$/, ''),
    };
  }
  return {
    fetchOrigin: '',
    basePath: base,
  };
}

/**
 * Sends a request to the backend API Gateway using the signed-in app session.
 */
export async function apiRequestWithMeta(path, { method = 'GET', body, headers, skipAuth = false } = {}) {
  const { cleanPath, search } = splitPathAndQuery(path);
  const { fetchOrigin, basePath } = resolveBaseUrl();
  const fullPathname = `${basePath}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
  const url = `${fetchOrigin}${fullPathname}${search}`;
  const bodyString = body !== undefined ? JSON.stringify(body) : '';

  let authHeaders = {};
  if (!skipAuth) {
    const session = getSession();
    if (!session) {
      throw buildError('Sign in with your email and password to continue.', {
        status: 401,
        code: 'NO_LOCAL_SESSION',
      });
    }
    authHeaders = { Authorization: `Bearer ${session.token}` };
  }

  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders,
      ...(headers || {}),
    },
    body: body !== undefined ? bodyString : undefined,
  });

  if (res.status === 429) {
    const seconds = Number(res.headers.get('Retry-After')) || 30;
    throw buildError(
      `Too many requests. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
      { status: 429, code: 'RATE_LIMITED', retryAfter: seconds }
    );
  }

  const meta = {
    status: res.status,
    cacheStatus: res.headers.get('X-Cache') || null,
    nextCursor: res.headers.get('X-Next-Cursor') || null,
    requestId: res.headers.get('X-Request-Id') || null,
  };

  if (res.status === 204) return { data: null, meta };

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw buildError(data?.error?.message || `Request failed (${res.status}).`, {
      status: res.status,
      code: data?.error?.code,
      details: data?.error?.details,
      requestId: data?.error?.request_id || meta.requestId,
    });
  }

  return { data, meta };
}

export async function apiRequest(pathOrService, optionsOrPath = {}, legacyOptions = {}) {
  // Older team pages pass a service key before the path; all services now use
  // the same backend API Gateway, so accept both signatures during migration.
  const path = typeof optionsOrPath === 'string' ? optionsOrPath : pathOrService;
  const options = typeof optionsOrPath === 'string' ? legacyOptions : optionsOrPath;
  const { data } = await apiRequestWithMeta(path, options);
  return data;
}

function buildError(message, extra) {
  return Object.assign(new Error(message), extra);
}
