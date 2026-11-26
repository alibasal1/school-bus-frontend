import { useState } from 'react';
import { apiRequest } from '../api';
import { saveSession } from '../auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await apiRequest('/api/sessions', {
        method: 'POST',
        body: { email: email.trim(), password },
        skipAuth: true,
      });
      saveSession(session);
      window.location.hash = '#/schedule';
    } catch (caught) {
      setError(caught.message || 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="wrap" style={{ maxWidth: 460, margin: '56px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--p-ink)' }}>
          Welcome back
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--p-muted)' }}>
          Sign in to see your child’s route, schedule, and attendance updates.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <label className="field">
          <span className="field__label">Email address</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>

        {error && <div className="banner banner--error" role="alert">{error}</div>}

        <button type="submit" disabled={loading} className="btn btn--primary" style={{ height: 46, fontSize: 15 }}>
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>

        <p style={{ fontSize: 13, color: 'var(--p-muted)', textAlign: 'center', margin: 0 }}>
          New to the tracker?{' '}
          <a href="#/signup" style={{ color: 'var(--p-accent)', textDecoration: 'none' }}>Create an account</a>
        </p>
      </form>
    </section>
  );
}
