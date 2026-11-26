import { useState } from 'react';
import { apiRequest } from '../api';
import { saveSession } from '../auth';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const session = await apiRequest('/api/users', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password },
        skipAuth: true,
      });
      saveSession(session);
      window.location.hash = '#/schedule';
    } catch (caught) {
      setError(caught.message || 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="wrap" style={{ maxWidth: 520, margin: '44px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <p className="hero-eyebrow">SCHOOL BUS ROUTE TRACKER</p>
        <h2 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--p-ink)' }}>
          Create your parent account
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--p-muted)' }}>
          Use your email and a password to get started. Your account is saved in the school tracker and signed in right away.
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label className="field">
          <span className="field__label">Full name</span>
          <input className="input" type="text" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Email address</span>
          <input className="input" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required />
          <span className="muted" style={{ fontSize: 12 }}>Use at least 8 characters.</span>
        </label>
        <label className="field">
          <span className="field__label">Confirm password</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </label>
        {error && <div className="banner banner--error" role="alert">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={loading} style={{ height: 46, fontSize: 15 }}>
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--p-muted)' }}>
          Already have an account? <a href="#/login" style={{ color: 'var(--p-accent)', textDecoration: 'none' }}>Sign in</a>
        </p>
      </form>
      <p style={{ color: 'var(--p-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 16 }}>
        New accounts start with parent access. A school administrator assigns student and bus records to your profile.
      </p>
    </section>
  );
}
