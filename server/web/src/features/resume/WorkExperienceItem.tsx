/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { WorkItem } from './resumeTypes';

export type WorkField = 'name' | 'position' | 'startDate' | 'endDate' | 'summary';

export interface WorkExperienceItemProps {
  work: WorkItem;
  workIndex: number;
  onUpdate: (field: WorkField, val: string) => void;
  onRemove: () => void;
  onAddHighlight: (text: string) => void;
  onUpdateHighlight: (highlightIndex: number, text: string) => void;
  onRemoveHighlight: (highlightIndex: number) => void;
}

export const WorkExperienceItem: React.FC<WorkExperienceItemProps> = ({
  work,
  workIndex,
  onUpdate,
  onRemove,
  onAddHighlight,
  onUpdateHighlight,
  onRemoveHighlight,
}) => {
  const [newHighlight, setNewHighlight] = useState('');

  const handleAddBullet = () => {
    if (!newHighlight.trim()) return;
    onAddHighlight(newHighlight);
    setNewHighlight('');
  };

  const highlights = Array.isArray(work.highlights) ? work.highlights : [];

  return (
    <div
      style={{
        background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
        padding: '0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
          {work.position
            ? `${work.position} @ ${work.name ?? 'Company'}`
            : `Work Entry #${workIndex + 1}`}
        </span>
        <button
          type="button"
          onClick={() => {
            onRemove();
          }}
          className="btn btn-danger btn-sm"
          style={{ padding: '0.2rem 0.4rem' }}
          title="Delete role"
          aria-label={`Delete role at ${work.name ?? workIndex + 1}`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <div>
          <label
            htmlFor={`work-${workIndex}-name`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Company Name
          </label>
          <input
            id={`work-${workIndex}-name`}
            type="text"
            value={work.name ?? ''}
            onChange={(e) => {
              onUpdate('name', e.target.value);
            }}
            placeholder="e.g. Acme Corp"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <label
            htmlFor={`work-${workIndex}-position`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Role / Title
          </label>
          <input
            id={`work-${workIndex}-position`}
            type="text"
            value={work.position ?? ''}
            onChange={(e) => {
              onUpdate('position', e.target.value);
            }}
            placeholder="e.g. Senior Software Engineer"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <div>
          <label
            htmlFor={`work-${workIndex}-start-date`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Start Date
          </label>
          <input
            id={`work-${workIndex}-start-date`}
            type="text"
            value={work.startDate ?? ''}
            onChange={(e) => {
              onUpdate('startDate', e.target.value);
            }}
            placeholder="YYYY-MM (e.g. 2021-03)"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <label
            htmlFor={`work-${workIndex}-end-date`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            End Date (leave blank or 'Present' if current)
          </label>
          <input
            id={`work-${workIndex}-end-date`}
            type="text"
            value={work.endDate ?? ''}
            onChange={(e) => {
              onUpdate('endDate', e.target.value);
            }}
            placeholder="YYYY-MM or Present"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`work-${workIndex}-summary`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Role Summary
        </label>
        <textarea
          id={`work-${workIndex}-summary`}
          value={work.summary ?? ''}
          onChange={(e) => {
            onUpdate('summary', e.target.value);
          }}
          placeholder="Brief overview of role responsibilities and team scope..."
          rows={2}
          className="input-text"
          style={{ resize: 'vertical', fontSize: '0.82rem' }}
        />
      </div>

      {/* Highlights / Accomplishment Bullets */}
      <div>
        <label
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '0.35rem',
          }}
        >
          Key Achievements & Responsibilities (Bullets)
        </label>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            marginBottom: '0.5rem',
          }}
        >
          {highlights.map((bullet: string, hIdx: number) => (
            <div
              key={hIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '0.4rem',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
              <input
                id={`work-${workIndex}-bullet-${hIdx}`}
                aria-label={`Achievement bullet ${hIdx + 1}`}
                type="text"
                value={bullet}
                onChange={(e) => {
                  onUpdateHighlight(hIdx, e.target.value);
                }}
                className="input-text"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  onRemoveHighlight(hIdx);
                }}
                className="btn btn-danger btn-sm"
                style={{ padding: '0.2rem 0.35rem' }}
                aria-label={`Delete bullet ${hIdx + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem' }}>
          <label htmlFor={`work-${workIndex}-new-bullet`} style={{ display: 'none' }}>
            Add achievement bullet
          </label>
          <input
            id={`work-${workIndex}-new-bullet`}
            aria-label="Add achievement bullet"
            type="text"
            value={newHighlight}
            onChange={(e) => {
              setNewHighlight(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddBullet();
              }
            }}
            placeholder="+ Add achievement bullet (e.g. 'Reduced latency by 40% with Go concurrency')..."
            className="input-text"
            style={{ fontSize: '0.8rem' }}
          />
          <button
            type="button"
            onClick={() => {
              handleAddBullet();
            }}
            disabled={!newHighlight.trim()}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem' }}
          >
            Add Bullet
          </button>
        </div>
      </div>
    </div>
  );
};
