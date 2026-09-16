import React, { useEffect, useState } from 'react';
import { api, RegistrationStatus } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const RegistrationControls: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getRegistrationStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (!user?.isAdmin) return null;

  const handleToggle = async (open: boolean) => {
    setSaving(true);
    try {
      const next = await api.updateRegistrationStatus(open);
      setStatus(next);
      toast.success(open ? 'New registrations enabled' : 'New registrations disabled');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update registration setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-card" style={{ padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
        Access &amp; Registration
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Registration is open by default so local AppImage/MSIX installs can create multiple
        accounts. As the first account (admin), you can close sign-ups here, or enforce it with{' '}
        <code>REGISTRATION_MODE=disabled</code> in <code>.env</code>.
      </p>

      {loading || !status ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {loading ? 'Loading registration status…' : 'Registration status unavailable.'}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span
            className={`badge ${status.open ? 'badge-green' : 'badge-muted'}`}
            style={{ fontSize: '0.8rem' }}
          >
            {status.open ? 'Open' : 'Closed'}
          </span>
          {status.environmentLocked ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Locked by <code>REGISTRATION_MODE=disabled</code> — UI changes are disabled.
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleToggle(!status.open)}
              disabled={saving}
              className="btn btn-secondary btn-sm"
            >
              {saving
                ? 'Saving…'
                : status.open
                  ? 'Disable new registrations'
                  : 'Enable new registrations'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
