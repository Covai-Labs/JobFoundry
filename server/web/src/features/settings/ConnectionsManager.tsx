import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  X,
  Zap,
} from 'lucide-react';
import { api, LLMConnection, TestConnectionResponse } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface ConnectionsManagerProps {
  connections: LLMConnection[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
}

interface SettingsModalProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  maxWidth?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  title,
  subtitle,
  maxWidth = '480px',
  onClose,
  children,
}) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
    }}
  >
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.75rem',
        width: '100%',
        maxWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{title}</h3>
          {subtitle && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{subtitle}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const ConnectionsManager: React.FC<ConnectionsManagerProps> = ({
  connections,
  loading = false,
  onRefresh,
}) => {
  const toast = useToast();

  // Create Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newConnApiType, setNewConnApiType] = useState('openai');
  const [newConnBaseUrl, setNewConnBaseUrl] = useState('');
  const [newConnApiKey, setNewConnApiKey] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit Key Modal State
  const [editingConn, setEditingConn] = useState<LLMConnection | null>(null);
  const [editKeyInput, setEditKeyInput] = useState('');
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [updatingKey, setUpdatingKey] = useState(false);

  // Test State per Connection
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, TestConnectionResponse | undefined>
  >({});

  const handleOpenAddModal = () => {
    setNewConnName('');
    setNewConnApiType('openai');
    setNewConnBaseUrl('');
    setNewConnApiKey('');
    setIsAddModalOpen(true);
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConnName.trim() || !newConnBaseUrl.trim()) {
      toast.error('Please provide a name and base URL');
      return;
    }
    try {
      setCreating(true);
      await api.createConnection({
        name: newConnName.trim(),
        apiType: newConnApiType.trim(),
        baseUrl: newConnBaseUrl.trim(),
        apiKey: newConnApiKey.trim(),
      });
      toast.success('Custom connection created successfully');
      setIsAddModalOpen(false);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create connection';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditKey = (conn: LLMConnection) => {
    setEditingConn(conn);
    setEditKeyInput('');
    setShowKeySecret(false);
  };

  const handleSaveEditKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConn) return;
    try {
      setUpdatingKey(true);
      await api.updateConnection(editingConn.id, { apiKey: editKeyInput.trim() });
      toast.success(`API key updated for ${editingConn.name}`);
      setEditingConn(null);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update API key';
      toast.error(msg);
    } finally {
      setUpdatingKey(false);
    }
  };

  const handleDeleteConnection = async (conn: LLMConnection) => {
    if (conn.isBuiltIn) return;
    if (conn.inUseBy.length) {
      const confirmInUse = window.confirm(
        `This connection is currently used by: ${conn.inUseBy.join(', ')}. Deleting it will fall back to the default gateway. Proceed?`
      );
      if (!confirmInUse) return;
    } else {
      const confirmDelete = window.confirm(`Delete connection "${conn.name}"?`);
      if (!confirmDelete) return;
    }

    try {
      await api.deleteConnection(conn.id);
      toast.success(`Deleted connection "${conn.name}"`);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete connection';
      toast.error(msg);
    }
  };

  const handleTestConnection = async (conn: LLMConnection) => {
    try {
      setTestingId(conn.id);
      const res = await api.testConnection(conn.id);
      setTestResults((prev) => ({ ...prev, [conn.id]: res }));
      if (res.ok) {
        toast.success(`Connection to ${conn.name} successful (${res.latencyMs ?? 0}ms)`);
      } else {
        toast.error(`Connection test failed: ${res.error ?? 'Unknown error'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      const errRes: TestConnectionResponse = {
        ok: false,
        endpoint: conn.baseUrl,
        error: msg,
      };
      setTestResults((prev) => ({ ...prev, [conn.id]: errRes }));
      toast.error(`Test failed: ${msg}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Add Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            AI Connections & Endpoints
          </h2>
          <p
            style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
          >
            Manage unified credentials and endpoints for built-in providers and custom LiteLLM
            proxies.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} /> Add Connection
          </button>
        </div>
      </div>

      {/* Connection Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1rem',
        }}
      >
        {connections.map((conn) => {
          const testRes = testResults[conn.id];
          const isTesting = testingId === conn.id;

          return (
            <div
              key={conn.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              {/* Card Header */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {conn.name}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.4rem',
                          borderRadius: 'var(--radius-xs)',
                          background: conn.isBuiltIn
                            ? 'rgba(99, 102, 241, 0.12)'
                            : 'rgba(16, 185, 129, 0.12)',
                          color: conn.isBuiltIn
                            ? 'var(--accent-primary)'
                            : 'var(--color-green, #10b981)',
                        }}
                      >
                        {conn.isBuiltIn ? 'Built-in' : 'Custom'}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {conn.apiType}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {conn.isConfigured ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                          color: 'var(--color-green, #10b981)',
                        }}
                      >
                        <CheckCircle2 size={13} /> Configured
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                          color: '#d97706',
                        }}
                      >
                        <AlertTriangle size={13} /> Key Required
                      </span>
                    )}
                  </div>
                </div>

                {/* Base URL */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Endpoint URL{' '}
                    {conn.isBuiltIn && (
                      <Lock size={11} style={{ verticalAlign: 'middle', marginLeft: '2px' }} />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {conn.baseUrl}
                  </div>
                </div>

                {/* In Use Badges */}
                {conn.inUseBy?.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>In use:</span>
                    {conn.inUseBy.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(255, 255, 255, 0.08)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 'var(--radius-xs)',
                          color: 'var(--text-primary)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* Test Result Feedback */}
                {testRes && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.75rem',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-xs)',
                      background: testRes.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${testRes.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      color: testRes.ok
                        ? 'var(--color-green, #10b981)'
                        : 'var(--color-red, #ef4444)',
                    }}
                  >
                    {testRes.ok
                      ? `✓ Live connection succeeded (${testRes.latencyMs ?? 0}ms)`
                      : `✗ Error: ${testRes.error ?? 'Connection failed'}`}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEditKey(conn);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Edit3 size={13} /> {conn.apiKey ? 'Update Key' : 'Set Key'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleTestConnection(conn);
                    }}
                    disabled={isTesting || (!conn.isConfigured && conn.apiType !== 'ollama')}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Zap size={13} className={isTesting ? 'animate-spin' : ''} />{' '}
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>
                </div>

                {!conn.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteConnection(conn);
                    }}
                    title="Delete custom connection"
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--color-red, #ef4444)', padding: '0.35rem 0.5rem' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Custom Connection */}
      {isAddModalOpen && (
        <SettingsModal
          title="Add Custom Connection"
          maxWidth="480px"
          onClose={() => {
            setIsAddModalOpen(false);
          }}
        >
          <form
            onSubmit={(e) => {
              void handleCreateConnection(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div>
              <label
                htmlFor="new-conn-name"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                Connection Name
              </label>
              <input
                id="new-conn-name"
                type="text"
                required
                placeholder="e.g. My LiteLLM Proxy or Work OpenAI"
                value={newConnName}
                onChange={(e) => {
                  setNewConnName(e.target.value);
                }}
                className="text-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              />
            </div>

            <div>
              <label
                htmlFor="new-conn-api-type"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                API Type
              </label>
              <select
                id="new-conn-api-type"
                value={newConnApiType}
                onChange={(e) => {
                  setNewConnApiType(e.target.value);
                }}
                className="text-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              >
                <option value="openai">
                  OpenAI compatible (LiteLLM, vLLM, Ollama, OpenRouter)
                </option>
                <option value="anthropic">Anthropic Messages</option>
                <option value="ollama">Ollama (Native/Local)</option>
                <option value="groq">Groq</option>
                <option value="deepseek">DeepSeek</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="new-conn-base-url"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                Base URL (Endpoint)
              </label>
              <input
                id="new-conn-base-url"
                type="url"
                required
                placeholder="https://litellm.example.com/v1"
                value={newConnBaseUrl}
                onChange={(e) => {
                  setNewConnBaseUrl(e.target.value);
                }}
                className="text-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Validated against SSRF; private loopback endpoints are allowed when trusted in
                config.
              </span>
            </div>

            <div>
              <label
                htmlFor="new-conn-api-key"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                API Key (Optional)
              </label>
              <input
                id="new-conn-api-key"
                type="password"
                placeholder="sk-..."
                value={newConnApiKey}
                onChange={(e) => {
                  setNewConnApiKey(e.target.value);
                }}
                className="text-input"
                style={{ width: '100%', padding: '0.5rem 0.75rem' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                }}
                className="btn btn-secondary"
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Connection'}
              </button>
            </div>
          </form>
        </SettingsModal>
      )}

      {/* Modal: Edit Connection Key */}
      {editingConn && (
        <SettingsModal
          title={`Update Key: ${editingConn.name}`}
          subtitle={editingConn.baseUrl}
          maxWidth="460px"
          onClose={() => {
            setEditingConn(null);
          }}
        >
          <form
            onSubmit={(e) => {
              void handleSaveEditKey(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div>
              <label
                htmlFor="edit-conn-api-key"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                New API Key
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="edit-conn-api-key"
                  type={showKeySecret ? 'text' : 'password'}
                  placeholder={editingConn.apiKey ? 'Enter new key to replace existing' : 'sk-...'}
                  value={editKeyInput}
                  onChange={(e) => {
                    setEditKeyInput(e.target.value);
                  }}
                  className="text-input"
                  style={{ width: '100%', padding: '0.5rem 2.5rem 0.5rem 0.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowKeySecret(!showKeySecret);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {showKeySecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {editingConn.apiKey && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.2rem',
                    display: 'block',
                  }}
                >
                  Current key is configured and safely masked: {editingConn.apiKey}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setEditingConn(null);
                }}
                className="btn btn-secondary"
                disabled={updatingKey}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updatingKey || !editKeyInput.trim()}
              >
                {updatingKey ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </form>
        </SettingsModal>
      )}
    </div>
  );
};
