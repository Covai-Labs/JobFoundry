import React from 'react';
import { Trash2 } from 'lucide-react';
import { ProjectItem } from './resumeTypes';

export type ProjectField = 'name' | 'url' | 'description';

export interface ProjectEntryItemProps {
  project: ProjectItem;
  index: number;
  onUpdate(field: ProjectField, val: string): void;
  onRemove(): void;
}

export const ProjectEntryItem: React.FC<ProjectEntryItemProps> = ({
  project,
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
        {project.name ?? `Project #${index + 1}`}
      </span>
      <button
        type="button"
        onClick={() => {
          onRemove();
        }}
        className="btn btn-danger btn-sm"
        style={{ padding: '0.2rem 0.4rem' }}
        title="Delete project"
        aria-label={`Delete project ${project.name ?? index + 1}`}
      >
        <Trash2 size={12} />
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
      <div>
        <label
          htmlFor={`project-${index}-name`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Project Name
        </label>
        <input
          id={`project-${index}-name`}
          type="text"
          value={project.name ?? ''}
          onChange={(e) => {
            onUpdate('name', e.target.value);
          }}
          placeholder="e.g. Distributed Consensus Engine"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`project-${index}-url`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Project URL
        </label>
        <input
          id={`project-${index}-url`}
          type="url"
          value={project.url ?? ''}
          onChange={(e) => {
            onUpdate('url', e.target.value);
          }}
          placeholder="https://github.com/..."
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>

    <div>
      <label
        htmlFor={`project-${index}-description`}
        style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
      >
        Description
      </label>
      <textarea
        id={`project-${index}-description`}
        value={project.description ?? ''}
        onChange={(e) => {
          onUpdate('description', e.target.value);
        }}
        placeholder="Short description of the problem solved and technologies used..."
        rows={2}
        className="input-text"
        style={{ resize: 'vertical', fontSize: '0.82rem' }}
      />
    </div>
  </div>
);
