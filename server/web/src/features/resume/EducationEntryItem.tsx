import React from 'react';
import { Trash2 } from 'lucide-react';
import { EducationItem } from './resumeTypes';

export type EducationField =
  'institution' | 'studyType' | 'area' | 'startDate' | 'endDate' | 'score';

export interface EducationEntryItemProps {
  education: EducationItem;
  index: number;
  onUpdate(field: EducationField, val: string): void;
  onRemove(): void;
}

export const EducationEntryItem: React.FC<EducationEntryItemProps> = ({
  education,
  index,
  onUpdate,
  onRemove,
}) => (
  <div
    style={{
      background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
      padding: '0.85rem',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
        {education.institution ?? `Education Entry #${index + 1}`}
      </span>
      <button
        type="button"
        onClick={() => {
          onRemove();
        }}
        className="btn btn-danger btn-sm"
        style={{ padding: '0.2rem 0.4rem' }}
        title="Delete education"
        aria-label={`Delete education at ${education.institution ?? index + 1}`}
      >
        <Trash2 size={12} />
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
      <div>
        <label
          htmlFor={`edu-${index}-institution`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Institution
        </label>
        <input
          id={`edu-${index}-institution`}
          type="text"
          value={education.institution ?? ''}
          onChange={(e) => {
            onUpdate('institution', e.target.value);
          }}
          placeholder="e.g. Stanford University"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`edu-${index}-degree`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Degree / Study Type
        </label>
        <input
          id={`edu-${index}-degree`}
          type="text"
          value={education.studyType ?? ''}
          onChange={(e) => {
            onUpdate('studyType', e.target.value);
          }}
          placeholder="e.g. Bachelor of Science"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: '0.6rem' }}>
      <div>
        <label
          htmlFor={`edu-${index}-area`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Field of Study / Major
        </label>
        <input
          id={`edu-${index}-area`}
          type="text"
          value={education.area ?? ''}
          onChange={(e) => {
            onUpdate('area', e.target.value);
          }}
          placeholder="Computer Science"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`edu-${index}-start-date`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Start Date
        </label>
        <input
          id={`edu-${index}-start-date`}
          type="text"
          value={education.startDate ?? ''}
          onChange={(e) => {
            onUpdate('startDate', e.target.value);
          }}
          placeholder="2018-09"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`edu-${index}-end-date`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          End Date
        </label>
        <input
          id={`edu-${index}-end-date`}
          type="text"
          value={education.endDate ?? ''}
          onChange={(e) => {
            onUpdate('endDate', e.target.value);
          }}
          placeholder="2022-06"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>
  </div>
);
