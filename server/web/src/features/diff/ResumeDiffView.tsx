import React from 'react';
import { computeResumeDiff, ProjectDiff, ResumeDiff } from '../../lib/diff';

interface ResumeDiffViewProps {
  originalResume?: Record<string, any>;
  tailoredResume?: Record<string, any>;
}

const isProjectChanged = (p: ProjectDiff): boolean =>
  [
    Boolean(p.isOmitted),
    Boolean(p.descriptionChange),
    p.highlights.some((h) => h.type !== 'unchanged'),
    p.keywords.some((k) => k.type !== 'unchanged'),
  ].some(Boolean);

export const ResumeDiffView: React.FC<ResumeDiffViewProps> = ({
  originalResume = {},
  tailoredResume = {},
}) => {
  const diff: ResumeDiff = computeResumeDiff(originalResume, tailoredResume);

  const hasBasicsDiff = Boolean(diff.basics.labelChange ?? diff.basics.summaryChange);
  const hasWorkDiff = diff.work.some((w) => w.highlights.some((h) => h.type !== 'unchanged'));
  const hasSkillsDiff = diff.skills.some((s) => s.keywords.some((k) => k.type !== 'unchanged'));
  const hasProjectsDiff = diff.projects.some(isProjectChanged);

  if (!hasBasicsDiff && !hasWorkDiff && !hasSkillsDiff && !hasProjectsDiff) {
    return (
      <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        No structural changes detected between the master and tailored resume.
      </div>
    );
  }

  return (
    <div className="diff-container">
      {hasBasicsDiff && (
        <div className="diff-section">
          <h4
            style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}
          >
            Profile & Summary
          </h4>
          {diff.basics.labelChange && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Title: </span>
              <span className="diff-item-removed" style={{ display: 'inline' }}>
                {diff.basics.labelChange.original}
              </span>
              {' ➔ '}
              <span className="diff-item-added" style={{ display: 'inline' }}>
                {diff.basics.labelChange.tailored}
              </span>
            </div>
          )}
          {diff.basics.summaryChange && (
            <div style={{ fontSize: '0.85rem' }}>
              <div className="diff-item-removed">{diff.basics.summaryChange.original}</div>
              <div className="diff-item-added">{diff.basics.summaryChange.tailored}</div>
            </div>
          )}
        </div>
      )}

      {hasWorkDiff && (
        <div className="diff-section">
          <h4
            style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--accent-primary)' }}
          >
            Work Experience Highlights
          </h4>
          {diff.work.map((w, idx) => (
            <div key={idx} style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                {w.company}{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({w.position})</span>
              </div>
              <div style={{ paddingLeft: '0.5rem' }}>
                {w.highlights.map((h, hIdx) => {
                  if (h.type === 'added') {
                    return (
                      <div key={hIdx} className="diff-item-added">
                        + {h.text}
                      </div>
                    );
                  }
                  if (h.type === 'removed') {
                    return (
                      <div key={hIdx} className="diff-item-removed">
                        - {h.text}
                      </div>
                    );
                  }
                  return (
                    <div key={hIdx} className="diff-item-unchanged" style={{ fontSize: '0.85rem' }}>
                      • {h.text}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasSkillsDiff && (
        <div className="diff-section">
          <h4
            style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--accent-primary)' }}
          >
            Skills & Keywords
          </h4>
          {diff.skills.map((s, idx) => (
            <div key={idx} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                {s.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {s.keywords.map((k, kIdx) => {
                  if (k.type === 'added') {
                    return (
                      <span key={kIdx} className="skill-chip skill-matching">
                        + {k.text}
                      </span>
                    );
                  }
                  if (k.type === 'removed') {
                    return (
                      <span key={kIdx} className="skill-chip skill-missing">
                        - {k.text}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={kIdx}
                      className="skill-chip"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {k.text}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasProjectsDiff && (
        <div className="diff-section">
          <h4
            style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--accent-primary)' }}
          >
            Projects
          </h4>
          {diff.projects.filter(isProjectChanged).map((p, idx) => (
            <div key={idx} style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  marginBottom: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>{p.name}</span>
                {p.isOmitted && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--danger, #ef4444)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    Omitted
                  </span>
                )}
              </div>

              {p.descriptionChange && (
                <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <div className="diff-item-removed">{p.descriptionChange.original}</div>
                  <div className="diff-item-added">{p.descriptionChange.tailored}</div>
                </div>
              )}

              {p.highlights.some((h) => h.type !== 'unchanged') && (
                <div style={{ paddingLeft: '0.5rem', marginBottom: '0.5rem' }}>
                  {p.highlights.map((h, hIdx) => {
                    if (h.type === 'added') {
                      return (
                        <div key={hIdx} className="diff-item-added">
                          + {h.text}
                        </div>
                      );
                    }
                    if (h.type === 'removed') {
                      return (
                        <div key={hIdx} className="diff-item-removed">
                          - {h.text}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={hIdx}
                        className="diff-item-unchanged"
                        style={{ fontSize: '0.85rem' }}
                      >
                        • {h.text}
                      </div>
                    );
                  })}
                </div>
              )}

              {p.keywords.some((k) => k.type !== 'unchanged') && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    paddingLeft: '0.5rem',
                  }}
                >
                  {p.keywords.map((k, kIdx) => {
                    if (k.type === 'added') {
                      return (
                        <span key={kIdx} className="skill-chip skill-matching">
                          + {k.text}
                        </span>
                      );
                    }
                    if (k.type === 'removed') {
                      return (
                        <span key={kIdx} className="skill-chip skill-missing">
                          - {k.text}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={kIdx}
                        className="skill-chip"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                      >
                        {k.text}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
