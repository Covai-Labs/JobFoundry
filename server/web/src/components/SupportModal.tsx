import React, { useEffect } from 'react';
import { X, Heart, Star, ExternalLink, MessageSquareHeart, Bug } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
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

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', padding: '1.5rem' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Heart size={20} style={{ color: 'var(--color-red, #ef4444)' }} />
            <h3
              id="support-modal-title"
              style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Support JobFoundry
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{
              borderRadius: 'var(--radius-full)',
              width: '28px',
              height: '28px',
              padding: 0,
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <p
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            marginBottom: '1.25rem',
          }}
        >
          JobFoundry is 100% open-source, local-first, and privacy-respecting. If it is helping your
          job hunt, here are great ways you can support the project:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* GitHub Star */}
          <a
            href="https://github.com/Covai-Labs/JobFoundry"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              textDecoration: 'none',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Star size={18} style={{ color: 'var(--color-amber, #f59e0b)' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Star on GitHub
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Help more job seekers find and use JobFoundry
                </div>
              </div>
            </div>
            <ExternalLink size={15} style={{ color: 'var(--text-muted)' }} />
          </a>

          {/* Sponsor */}
          <a
            href="https://github.com/sponsors/Covai-Labs"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              textDecoration: 'none',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MessageSquareHeart size={18} style={{ color: 'var(--color-red, #ef4444)' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Sponsor the Project
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Support ongoing development and infrastructure maintenance
                </div>
              </div>
            </div>
            <ExternalLink size={15} style={{ color: 'var(--text-muted)' }} />
          </a>

          {/* Feedback & Issues */}
          <a
            href="https://github.com/Covai-Labs/JobFoundry/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              textDecoration: 'none',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Bug size={18} style={{ color: 'var(--color-blue, #3b82f6)' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Report Issues & Feedback
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Suggest features, request job board adapters, or report bugs
                </div>
              </div>
            </div>
            <ExternalLink size={15} style={{ color: 'var(--text-muted)' }} />
          </a>
        </div>

        <div
          style={{
            marginTop: '1.25rem',
            textAlign: 'right',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
