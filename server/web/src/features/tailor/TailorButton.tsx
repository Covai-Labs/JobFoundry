import React, { useState } from 'react';
import { api } from '../../api/client';
import { Job } from '../../types/job';

interface TailorButtonProps {
  job: Job;
  onTailored?: (updatedJob: Job) => void;
  className?: string;
}

export const TailorButton: React.FC<TailorButtonProps> = ({ job, onTailored, className = '' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTailored = job.status === 'tailored' || Boolean(job.tailored_resume_id);

  const handleTailor = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.tailor(job.id);
      if (onTailored) {
        onTailored(res.job);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to tailor');
    } finally {
      setLoading(false);
    }
  };

  if (isTailored) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <span className="badge badge-purple" title="Resume tailored">
          Tailored ✓
        </span>
        <button
          onClick={handleTailor}
          disabled={loading}
          className={`btn btn-secondary btn-sm ${className}`}
          title="Re-run tailoring against current master resume"
          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
        >
          {loading ? 'Tailoring...' : '🔄 Re-tailor'}
        </button>
        {error && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-red)', marginLeft: '0.25rem' }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button
        onClick={handleTailor}
        disabled={loading}
        className={`btn btn-primary btn-sm ${className}`}
      >
        {loading ? 'Tailoring...' : 'Tailor CV'}
      </button>
      {error && (
        <span style={{ fontSize: '0.7rem', color: 'var(--color-red)', marginTop: '0.2rem' }}>
          {error}
        </span>
      )}
    </div>
  );
};
