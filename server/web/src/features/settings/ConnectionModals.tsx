/* eslint-disable no-unused-vars */
import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { LLMConnection } from '../../api/client';

export interface SettingsModalProps {
  title: string;
  subtitle?: string;
  maxWidth?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
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
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}
  >
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '8px',
        maxWidth,
        width: '100%',
        padding: '1.25rem',
        border: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h4>
          {subtitle && (
            <p
              style={{
                margin: '0.2rem 0 0',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              {subtitle}
            </p>
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

export interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  creating: boolean;
  name: string;
  setName: (v: string) => void;
  apiType: string;
  setApiType: (v: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
}

export const AddConnectionModal: React.FC<AddConnectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  creating,
  name,
  setName,
  apiType,
  setApiType,
  baseUrl,
  setBaseUrl,
  apiKey,
  setApiKey,
}) => {
  if (!isOpen) return null;

  return (
    <SettingsModal title="Add Custom Connection" maxWidth="480px" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            value={name}
            onChange={(e) => {
              setName(e.target.value);
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
            value={apiType}
            onChange={(e) => {
              setApiType(e.target.value);
            }}
            className="text-input"
            style={{ width: '100%', padding: '0.5rem 0.75rem' }}
          >
            <option value="openai">OpenAI compatible (LiteLLM, vLLM, Ollama, OpenRouter)</option>
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
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
            }}
            className="text-input"
            style={{ width: '100%', padding: '0.5rem 0.75rem' }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Validated against SSRF; private loopback endpoints are allowed when trusted in config.
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
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
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
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={creating}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Connection'}
          </button>
        </div>
      </form>
    </SettingsModal>
  );
};

export interface EditKeyModalProps {
  conn: LLMConnection | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  updatingKey: boolean;
  editKeyInput: string;
  setEditKeyInput: (v: string) => void;
  showKeySecret: boolean;
  setShowKeySecret: (v: boolean) => void;
}

export const EditKeyModal: React.FC<EditKeyModalProps> = ({
  conn,
  onClose,
  onSubmit,
  updatingKey,
  editKeyInput,
  setEditKeyInput,
  showKeySecret,
  setShowKeySecret,
}) => {
  if (!conn) return null;

  return (
    <SettingsModal
      title={`Update Key: ${conn.name}`}
      subtitle={conn.baseUrl}
      maxWidth="460px"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              placeholder={conn.apiKey ? 'Enter new key to replace existing' : 'sk-...'}
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
          {conn.apiKey && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginTop: '0.2rem',
                display: 'block',
              }}
            >
              Current key is configured and safely masked: {conn.apiKey}
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
            onClick={onClose}
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
  );
};
