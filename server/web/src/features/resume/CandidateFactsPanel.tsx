import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, CheckCircle2, XCircle, Info, Lock } from 'lucide-react';
import { api, UserFact, FactCategory } from '../../api/client';

export interface CategoryStyle {
  label: string;
  color: string;
  bg: string;
  border: string;
  placeholder: string;
}

export const CATEGORY_CONFIG: Record<FactCategory, CategoryStyle> = {
  preference: {
    label: 'Preference',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.3)',
    placeholder: 'e.g. Remote-first, UTC+5:30 timezone, max 10% travel',
  },
  constraint: {
    label: 'Constraint',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    placeholder: 'e.g. 60-day notice period, requires H-1B sponsorship',
  },
  context: {
    label: 'Context',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
    placeholder: 'e.g. Took 8-month sabbatical for elder care in 2023',
  },
  style: {
    label: 'Style & Voice',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.3)',
    placeholder: 'e.g. Direct and technical tone; avoid buzzwords like "synergy"',
  },
  compensation: {
    label: 'Compensation',
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.3)',
    placeholder: 'e.g. Target minimum base $160k, open to equity trade-offs',
  },
};

export function getCategoryStyle(category: string): CategoryStyle {
  switch (category) {
    case 'preference':
      return CATEGORY_CONFIG.preference;
    case 'constraint':
      return CATEGORY_CONFIG.constraint;
    case 'context':
      return CATEGORY_CONFIG.context;
    case 'style':
      return CATEGORY_CONFIG.style;
    case 'compensation':
      return CATEGORY_CONFIG.compensation;
    default:
      return {
        label: category,
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: 'rgba(148, 163, 184, 0.25)',
        placeholder: 'Enter candidate preference or constraint...',
      };
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export const CandidateFactsPanel: React.FC = () => {
  const [facts, setFacts] = useState<UserFact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New fact form
  const [newCategory, setNewCategory] = useState<FactCategory>('preference');
  const [newFactText, setNewFactText] = useState<string>('');

  const loadFacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFacts();
      setFacts(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load candidate facts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFacts();
  }, []);

  const handleAddFact = async () => {
    if (!newFactText.trim()) return;

    try {
      setSaving(true);
      setError(null);
      const created = await api.createFact({
        category: newCategory,
        factText: newFactText.trim(),
        isActive: true,
      });
      setFacts((prev) => [...prev, created]);
      setNewFactText('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to add fact'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (fact: UserFact) => {
    try {
      const updated = await api.patchFact(fact.id, { isActive: !fact.isActive });
      setFacts((prev) => prev.map((f) => (f.id === fact.id ? updated : f)));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update fact'));
    }
  };

  const handleDeleteFact = async (id: string) => {
    try {
      await api.deleteFact(id);
      setFacts((prev) => prev.filter((f) => f.id !== id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete fact'));
    }
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Lock size={16} style={{ color: 'var(--accent-primary, #818cf8)' }} />
            Private Candidate Context & Non-Negotiables
          </h3>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              margin: '0.25rem 0 0 0',
            }}
          >
            Facts stored here guide job fit scoring, role tailoring, and outreach drafts. Generation
            instructions ask the model not to copy them into public CV text or outreach drafts, but
            this is not enforced. Pause or delete any fact you do not want used.
          </p>
        </div>
        <span
          className="badge"
          style={{
            fontSize: '0.75rem',
            background: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--accent-primary, #818cf8)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <ShieldCheck size={13} /> {facts.filter((f) => f.isActive).length} Active Context Facts
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: '#fca5a5',
            fontSize: '0.82rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Add Fact Form */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr auto',
          gap: '0.6rem',
          alignItems: 'center',
          background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle, rgba(255,255,255,0.12))',
        }}
      >
        <label htmlFor="fact-category-select" style={{ display: 'none' }}>
          Category
        </label>
        <select
          id="fact-category-select"
          aria-label="Fact category"
          value={newCategory}
          onChange={(e) => {
            setNewCategory(e.target.value as FactCategory);
          }}
          className="input-text"
          style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.85rem' }}
          disabled={loading || saving}
        >
          {Object.entries(CATEGORY_CONFIG).map(([catKey, conf]) => (
            <option key={catKey} value={catKey}>
              {conf.label}
            </option>
          ))}
        </select>

        <label htmlFor="new-fact-text" style={{ display: 'none' }}>
          Fact description
        </label>
        <input
          id="new-fact-text"
          aria-label="Fact description"
          type="text"
          value={newFactText}
          onChange={(e) => {
            setNewFactText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleAddFact();
            }
          }}
          placeholder={getCategoryStyle(newCategory).placeholder}
          className="input-text"
          style={{ height: '38px', fontSize: '0.85rem' }}
          disabled={loading || saving}
        />

        <button
          type="button"
          onClick={() => void handleAddFact()}
          disabled={loading || saving || !newFactText.trim()}
          className="btn btn-primary btn-sm"
          style={{
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={15} /> Add Context Fact
        </button>
      </div>

      {/* Facts List */}
      {loading ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading context facts...
        </div>
      ) : facts.length === 0 ? (
        <div
          style={{
            padding: '1.25rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Info size={18} style={{ margin: '0 auto 0.4rem', opacity: 0.6 }} />
          No private context facts recorded yet. Add preferences (e.g. Remote-first), constraints
          (notice period, visa), or career notes above to steer AI decisions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {facts.map((fact) => {
            const conf = getCategoryStyle(fact.category);
            return (
              <div
                key={fact.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.85rem',
                  background: fact.isActive
                    ? 'var(--bg-card-inner, rgba(255,255,255,0.03))'
                    : 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${fact.isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                  opacity: fact.isActive ? 1 : 0.6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      color: conf.color,
                      backgroundColor: conf.bg,
                      border: `1px solid ${conf.border}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {conf.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      color: fact.isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      textDecoration: fact.isActive ? 'none' : 'line-through',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fact.factText}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleActive(fact);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                    title={fact.isActive ? 'Disable fact' : 'Enable fact'}
                    aria-label={
                      fact.isActive
                        ? `Pause fact: ${fact.factText}`
                        : `Activate fact: ${fact.factText}`
                    }
                  >
                    {fact.isActive ? (
                      <>
                        <CheckCircle2 size={13} style={{ color: '#34d399' }} /> Active
                      </>
                    ) : (
                      <>
                        <XCircle size={13} style={{ color: '#94a3b8' }} /> Paused
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteFact(fact.id);
                    }}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                    title="Delete fact"
                    aria-label={`Delete fact: ${fact.factText}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
