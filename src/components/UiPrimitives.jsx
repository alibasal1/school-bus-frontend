export function StatusBadge({ children, tone = 'neutral' }) {
  const cls =
    tone === 'accent'
      ? 'badge badge--accent'
      : tone === 'warn'
        ? 'badge badge--warn'
        : tone === 'danger'
          ? 'badge badge--danger'
          : 'badge';
  return <span className={cls}>{children}</span>;
}

export function CacheBadge({ cacheStatus }) {
  if (!cacheStatus) return null;
  const hit = cacheStatus.toUpperCase() === 'HIT';
  return (
    <StatusBadge tone={hit ? 'accent' : 'neutral'}>
      X-Cache: {cacheStatus}
    </StatusBadge>
  );
}

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message;
  const meta =
    typeof error === 'object' && (error.status || error.code)
      ? `${error.status ? `HTTP ${error.status}` : ''}${error.code ? ` · ${error.code}` : ''}`
      : null;

  return (
    <div role="alert" className="banner banner--error">
      <div>
        <strong>{msg}</strong>
        {meta && <span className="mono muted" style={{ marginLeft: 10 }}>{meta}</span>}
      </div>
      {onDismiss && (
        <button type="button" className="btn btn--sm" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div role="status" className="banner banner--success">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="btn btn--sm" onClick={onDismiss}>
          Close
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="card" style={{ borderStyle: 'dashed', color: 'var(--p-muted)' }}>
      {children}
    </div>
  );
}
