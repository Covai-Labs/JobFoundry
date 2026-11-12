import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SkillItem } from './resumeTypes';

export interface SkillGroupItemProps {
  group: SkillItem;
  groupIndex: number;
  onUpdateName: (name: string) => void;
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keywordIndex: number) => void;
  onRemoveGroup: () => void;
}

export const SkillGroupItem: React.FC<SkillGroupItemProps> = ({
  group,
  groupIndex,
  onUpdateName,
  onAddKeyword,
  onRemoveKeyword,
  onRemoveGroup,
}) => {
  const [newKeyword, setNewKeyword] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      onAddKeyword(newKeyword);
      setNewKeyword('');
    }
  };

  const handleAddClick = () => {
    onAddKeyword(newKeyword);
    setNewKeyword('');
  };

  const keywords = Array.isArray(group.keywords) ? group.keywords : [];

  return (
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <label htmlFor={`skill-group-${groupIndex}-name`} style={{ display: 'none' }}>
          Category Name
        </label>
        <input
          id={`skill-group-${groupIndex}-name`}
          aria-label="Category Name"
          type="text"
          value={group.name ?? ''}
          onChange={(e) => {
            onUpdateName(e.target.value);
          }}
          placeholder="Category name (e.g. Languages, Cloud & DevOps, Databases)"
          className="input-text"
          style={{ fontWeight: 600, fontSize: '0.88rem' }}
        />
        <button
          type="button"
          onClick={() => {
            onRemoveGroup();
          }}
          className="btn btn-danger btn-sm"
          style={{ padding: '0.2rem 0.4rem' }}
          title="Delete category"
          aria-label={`Delete skill category ${group.name ?? groupIndex + 1}`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Keyword Tag Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        {keywords.map((kw: string, kIdx: number) => (
          <span
            key={kIdx}
            className="badge"
            style={{
              fontSize: '0.75rem',
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.5rem',
            }}
          >
            {kw}
            <button
              type="button"
              onClick={() => {
                onRemoveKeyword(kIdx);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                fontSize: '0.75rem',
                lineHeight: 1,
              }}
              aria-label={`Remove skill tag ${kw}`}
            >
              ✕
            </button>
          </span>
        ))}

        <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <label htmlFor={`skill-group-${groupIndex}-add-keyword`} style={{ display: 'none' }}>
            Add skill tag
          </label>
          <input
            id={`skill-group-${groupIndex}-add-keyword`}
            aria-label="Add skill tag"
            type="text"
            value={newKeyword}
            onChange={(e) => {
              setNewKeyword(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="+ Add skill tag"
            className="input-text"
            style={{
              fontSize: '0.75rem',
              height: '26px',
              padding: '0 0.5rem',
              width: '120px',
            }}
          />
          {newKeyword.trim() && (
            <button
              type="button"
              onClick={() => {
                handleAddClick();
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', height: '26px' }}
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
