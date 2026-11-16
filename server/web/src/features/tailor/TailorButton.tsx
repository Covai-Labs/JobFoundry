import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { Job } from '../../types/job';

interface TailorButtonProps {
  job: Job;
  onTailored?: (updatedJob: Job) => void;
  className?: string;
}

/**
 * One control, one job: generate or regenerate the tailored resume. The
 * "Tailored" state itself is shown by the stage pill / card badge, so this
 * button never repeats it as a second badge.
 */
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

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button
        onClick={handleTailor}
        disabled={loading}
        className={`btn btn-secondary btn-sm ${className}`.trim()}
        title={
          isTailored
            ? 'Re-run tailoring against the current master resume'
            : 'Generate a resume tailored to this job'
        }
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
      >
        {isTailored ? <RefreshCw size={13} /> : <Sparkles size={13} />}
        {loading ? 'Tailoring...' : isTailored ? 'Re-tailor' : 'Tailor CV'}
      </button>
      {error && (
        <span
          style={{
            fontSize: '0.7rem',
            color: 'var(--color-red)',
            marginTop: '0.2rem',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
};
