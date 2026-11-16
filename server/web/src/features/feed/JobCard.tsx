import React from 'react';
import { Job, JobStatus } from '../../types/job';
import { getScoreCategory, parseFitNotes, parseRepostStatus } from '../filters/filterUtils';
import { TailorButton } from '../tailor/TailorButton';
import { getQuickApplyTarget, getStatusLabel } from '../../lib/jobStages';
import { MapPin, Check, CheckCircle2 } from 'lucide-react';

interface JobCardProps {
  job: Job;
  threshold?: number;
  onSelect: (job: Job) => void;
  onTailored?: (updatedJob: Job) => void;
  onStatusChange?: (jobId: string, status: JobStatus) => void;
}

function getStatusBadgeClass(status: JobStatus): string {
  if (status === 'tailored') return 'badge-purple';
  if (status === 'rejected_by_score' || status === 'rejected') return 'badge-red';
  if (status === 'archived') return 'badge-muted';
  return 'badge-blue';
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  threshold = 75,
  onSelect,
  onTailored,
  onStatusChange,
}) => {
  const fitNotes = parseFitNotes(job.fit_notes);
  const repostInfo = parseRepostStatus(job.repost_status);
  const scoreCat = getScoreCategory(job.fit_score, threshold);
  const quickApplyTarget = getQuickApplyTarget(job.status);

  return (
    <div className="job-card" onClick={() => onSelect(job)}>
      <div>
        <div className="job-card-header">
          <div>
            <h3 className="job-card-title">{job.title}</h3>
            <div className="job-card-company">{job.company}</div>
          </div>
          {job.fit_score !== null && job.fit_score !== undefined ? (
            <span className={`score-badge score-${scoreCat}`}>{job.fit_score}%</span>
          ) : (
            <span className="score-badge score-unscored">Unscored</span>
          )}
        </div>

        <div className="job-card-meta">
          {job.location && (
            <span
              className="meta-item"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
            >
              <MapPin size={13} style={{ flexShrink: 0 }} /> {job.location}
            </span>
          )}
          <span className="badge badge-indigo">{job.source}</span>
          <span className={`badge ${getStatusBadgeClass(job.status)}`}>
            {getStatusLabel(job.status)}
          </span>
          {job.repost_confidence === 'high' && (
            <span
              className="badge badge-amber"
              title={repostInfo.reason ?? 'Likely recycled or ghost repost'}
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                cursor: 'help',
              }}
            >
              ⚠️ Repost
            </span>
          )}
        </div>

        {/* Skills Chips Snippet */}
        {fitNotes.matching_skills && fitNotes.matching_skills.length > 0 && (
          <div className="skills-container">
            {fitNotes.matching_skills.slice(0, 3).map((s, idx) => (
              <span
                key={idx}
                className="skill-chip skill-matching"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Check size={11} /> {s}
              </span>
            ))}
            {fitNotes.matching_skills.length > 3 && (
              <span
                className="skill-chip"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
              >
                +{fitNotes.matching_skills.length - 3} more
              </span>
            )}
          </div>
        )}

        {fitNotes.error || job.status === 'score_failed' ? (
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-danger, #e5484d)',
              marginTop: '0.5rem',
              fontWeight: 600,
            }}
            title="Scoring failed — check your LLM settings"
          >
            {fitNotes.error || 'No API key configured — go to Settings to add your LLM key.'}
          </p>
        ) : null}

        {fitNotes.reasoning && (
          <p
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {fitNotes.reasoning}
          </p>
        )}
      </div>

      <div className="job-card-footer-actions">
        <span className="job-card-date">{new Date(job.created_at).toLocaleDateString()}</span>
        <div className="job-card-actions">
          {onStatusChange && quickApplyTarget && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(job.id, quickApplyTarget);
              }}
              className="btn btn-primary btn-sm job-card-apply"
              title="Record that you sent this application"
            >
              <CheckCircle2 size={13} /> Mark Applied
            </button>
          )}
          <TailorButton job={job} onTailored={onTailored} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(job);
            }}
            className="btn btn-secondary btn-sm"
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  );
};
