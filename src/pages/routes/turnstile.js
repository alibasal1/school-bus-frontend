// Cloudflare Turnstile token, for the write endpoints of the Route & Stop API.
//
// The API verifies the token server-side and refuses a write with 403
// BOT_CHECK_FAILED when it is missing — but only when TURNSTILE_SECRET_KEY is
// configured on the server. During development, and in the lab demo, it is
// not, so the API skips the check and this returns null.
//
// Keeping it in one place means the page never has to care which of those two
// situations it is in: it always asks for a token and sends one if there is
// one.
//
// When the widget is added later, load Cloudflare's script in index.html and
// render the widget with the site key (the site key is public; the secret key
// belongs only on the server).

/**
 * The current Turnstile token, or null when the widget is not on the page.
 * @returns {string|null}
 */
export function getTurnstileToken() {
  if (typeof window === 'undefined') return null;

  // Cloudflare's script writes the token into a hidden input named
  // cf-turnstile-response inside the form that holds the widget.
  const field = document.querySelector('input[name="cf-turnstile-response"]');
  const token = field && field.value ? field.value.trim() : '';
  return token || null;
}

/**
 * Headers for a write request: the bot token when there is one, nothing when
 * there is not. Spreading an empty object adds no headers, so a request made
 * without Turnstile looks exactly as it did before.
 */
export function turnstileHeaders() {
  const token = getTurnstileToken();
  return token ? { 'X-Turnstile-Token': token } : {};
}

/**
 * A fresh Idempotency-Key.
 *
 * Sent on creates so that a double click, or a retry after a timeout, cannot
 * produce two routes or two months of trips: the API replays its first
 * response instead of doing the work twice. A new key per attempt by the
 * user, reused if the same attempt is retried.
 */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Older browsers: good enough, since the key only has to be unique per user
  // per endpoint, and the server scopes it to both.
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
