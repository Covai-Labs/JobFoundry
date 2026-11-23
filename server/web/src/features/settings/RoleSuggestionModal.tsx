import React, { useState, useEffect } from 'react';
import { Sparkles, X, Check, Plus } from 'lucide-react';

export interface RoleSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: string[];
  source?: 'llm' | 'heuristic';
  notice?: string;
  onApply: (selectedRoles: string[], mode: 'append' | 'replace') => void;
}

export const RoleSuggestionModal: React.FC<RoleSuggestionModalProps> = ({
  isOpen,
  onClose,
  roles,
  source = 'llm',
  notice,
  onApply,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [insertMode, setInsertMode] = useState<'append' | 'replace'>('append');

  // Initialize all roles as selected whenever a new set of roles is passed
  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(roles));
      setInsertMode('append');
    }
  }, [isOpen, roles]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleRole = (role: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSelectAll = () => setSelected(new Set(roles));
  const handleDeselectAll = () => setSelected(new Set());

  const handleConfirm = () => {
    const chosen = roles.filter((r) => selected.has(r));
    if (chosen.length === 0) return;
    onApply(chosen, insertMode);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-suggestion-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #1e293b)',
          borderRadius: 'var(--radius-lg, 12px)',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-color, #334155)',
          boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.5))',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem 0.75rem',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.25rem',
              }}
            >
              <Sparkles size={18} style={{ color: 'var(--color-amber, #f59e0b)' }} />
              <h3
                id="role-suggestion-title"
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                AI Role Keyword Suggestions
              </h3>
              <span
                className="badge"
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  background:
                    source === 'llm' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color:
                    source === 'llm'
                      ? 'var(--accent-primary, #6366f1)'
                      : 'var(--color-amber, #f59e0b)',
                  border:
                    source === 'llm'
                      ? '1px solid rgba(99, 102, 241, 0.3)'
                      : '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                {source === 'llm' ? '✨ AI Synthesized' : 'Standard Heuristic'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Synthesized from your active master resume. Choose the target job titles to match
              against incoming jobs.
            </p>
            {notice && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-amber, #f59e0b)',
                  marginTop: '0.35rem',
                  marginBottom: 0,
                }}
              >
                ℹ {notice}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem', borderRadius: '50%', minWidth: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar: Select All / None & Counter */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            background: 'rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            borderBottom: '1px solid var(--border-color, #334155)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
            >
              Deselect All
            </button>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
            {selected.size} of {roles.length} selected
          </span>
        </div>

        {/* Role Pills Grid */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            maxHeight: '45vh',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          {roles.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                width: '100%',
                color: 'var(--text-muted)',
                padding: '2rem 0',
              }}
            >
              No roles detected in active resume.
            </div>
          ) : (
            roles.map((role) => {
              const isChecked = selected.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  role="checkbox"
                  aria-checked={isChecked}
                  onClick={() => toggleRole(role)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isChecked
                      ? '1px solid var(--accent-primary, #6366f1)'
                      : '1px solid var(--border-color, #334155)',
                    background: isChecked ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: isChecked
                      ? 'var(--accent-text, #ffffff)'
                      : 'var(--text-secondary, #94a3b8)',
                  }}
                >
                  {isChecked ? (
                    <Check size={14} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                  ) : (
                    <Plus size={14} style={{ opacity: 0.5 }} />
                  )}
                  {role}
                </button>
              );
            })
          )}
        </div>

        {/* Insertion Mode */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-color, #334155)',
            background: 'rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            fontSize: '0.82rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Target List Mode:</span>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="insertMode"
              value="append"
              checked={insertMode === 'append'}
              onChange={() => setInsertMode('append')}
            />
            Append to existing keywords
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="insertMode"
              value="replace"
              checked={insertMode === 'replace'}
              onChange={() => setInsertMode('replace')}
            />
            Replace all existing
          </label>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Check size={14} /> Add Selected Roles ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
};
