import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

interface LoginViewProps {
  onSwitchToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(true);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    api
      .getRegistrationStatus()
      .then((status) => {
        setRegistrationOpen(status.open);
        setUserCount(status.userCount ?? null);
        if (status.userCount === 0 && status.open) {
          onSwitchToRegister();
        }
      })
      .catch(() => setRegistrationOpen(null));
  }, [onSwitchToRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1e1e38 0%, #0c0d14 100%)',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem',
          background: 'rgba(20, 21, 33, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/icons/logo.webp"
            alt="JobFoundry Logo"
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              marginBottom: '0.75rem',
              objectFit: 'contain',
            }}
          />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Job<span className="brand-gradient">Foundry</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Sign in to access your automated job command center
          </p>
        </div>

        {userCount === 0 && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              🚀 Fresh Installation Detected
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.75rem',
              }}
            >
              No accounts exist yet. Create your administrator account to get started.
            </div>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
            >
              Create Administrator Account →
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                marginBottom: '0.4rem',
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-text"
              required
              autoFocus
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                marginBottom: '0.4rem',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-text"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {registrationOpen === true && (
          <div
            style={{
              marginTop: '2rem',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            Don't have an account yet?{' '}
            <button
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary-light, #818cf8)',
                cursor: 'pointer',
                fontWeight: 600,
                padding: 0,
              }}
            >
              Create Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
