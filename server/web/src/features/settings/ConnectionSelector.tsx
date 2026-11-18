import React from 'react';
import { Lock, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LLMConnection } from '../../api/client';

interface ConnectionSelectorProps {
  label?: string;
  selectedConnectionId: string;
  connections: LLMConnection[];
  onSelectConnectionId: (_id: string) => void;
  onManageConnections?: () => void;
  disabled?: boolean;
}

export const ConnectionSelector: React.FC<ConnectionSelectorProps> = ({
  label = 'AI Connection',
  selectedConnectionId,
  connections,
  onSelectConnectionId,
  onManageConnections,
  disabled = false,
}) => {
  const currentConn =
    connections.find((c) => c.id === selectedConnectionId) ||
    connections.find((c) => c.id === 'conn_builtin_openrouter') ||
    connections[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
        </label>
        {onManageConnections && (
          <button
            type="button"
            onClick={onManageConnections}
            className="btn btn-link"
            style={{
              padding: 0,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--accent-primary)',
            }}
          >
            <Plus size={12} /> Manage Connections
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select
          value={currentConn ? currentConn.id : selectedConnectionId}
          onChange={(e) => onSelectConnectionId(e.target.value)}
          disabled={disabled}
          className="text-input"
          style={{
            flex: 1,
            padding: '0.55rem 0.75rem',
            fontSize: '0.875rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.apiType}) {c.isBuiltIn ? '— Built-in' : '— Custom'}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Connection Overview */}
      {currentConn && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.45rem 0.65rem',
            fontSize: '0.78rem',
            marginTop: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Endpoint:</span>
            <code
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-primary)',
                wordBreak: 'break-all',
              }}
            >
              {currentConn.baseUrl}
            </code>
            {currentConn.isBuiltIn && (
              <span
                title="Endpoint is locked for built-in provider"
                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}
              >
                <Lock size={11} />
              </span>
            )}
          </div>

          <div>
            {currentConn.isConfigured ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: 'var(--color-green, #10b981)',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              >
                <CheckCircle2 size={12} /> Key Ready
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  color: '#d97706',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              >
                <AlertTriangle size={12} /> No Key
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
