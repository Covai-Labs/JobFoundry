import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CollapsibleSectionProps {
  id: string;
  title: string;
  countBadge?: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  countBadge,
  icon,
  isOpen,
  onToggle,
  children,
}) => (
  <div
    className="card"
    style={{
      padding: '1rem',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    }}
  >
    <button
      id={`section-btn-${id}`}
      type="button"
      onClick={() => {
        onToggle();
      }}
      aria-expanded={isOpen}
      aria-controls={`section-content-${id}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon}
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          {title} {countBadge && <span style={{ opacity: 0.75 }}>({countBadge})</span>}
        </h4>
      </div>
      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>

    {isOpen && (
      <div
        id={`section-content-${id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginTop: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '0.85rem',
        }}
      >
        {children}
      </div>
    )}
  </div>
);
