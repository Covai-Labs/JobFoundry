import React, { useState, useEffect } from 'react';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import {
  Sparkles,
  AlertCircle,
  RefreshCw,
  Tag,
  FileEdit,
  Code2,
  Save,
  PlusCircle,
} from 'lucide-react';
import { api, UserResume } from '../../api/client';
import resumeSchema from './resume-schema.json';
import { extractKeywordsFromResume } from '../../lib/resumeKeywords';
import { ResumeFormEditor, ResumeData, SkillItem } from './ResumeFormEditor';
import { CandidateFactsPanel } from './CandidateFactsPanel';

const AjvClass = (Ajv as any).default || Ajv;
const addFormatsFn = (addFormats as any).default || addFormats;

const ajv = new AjvClass({ strict: false, allErrors: true, validateSchema: false });
addFormatsFn(ajv);
const schemaValidator = ajv.compile(resumeSchema);

export interface ResumeManagerProps {
  onActiveResumeChange?: (hasActive: boolean) => void;
}

export const ResumeManager: React.FC<ResumeManagerProps> = ({ onActiveResumeChange }) => {
  const [resumes, setResumes] = useState<UserResume[]>([]);
  const [activeResume, setActiveResume] = useState<UserResume | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editor states
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');
  const [title, setTitle] = useState<string>('Master Resume');
  const [jsonText, setJsonText] = useState<string>('');
  const [parsedResume, setParsedResume] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  // AI Raw Resume Converter states
  const [showAiConvertModal, setShowAiConvertModal] = useState<boolean>(false);
  const [rawResumeText, setRawResumeText] = useState<string>('');
  const [convertingRaw, setConvertingRaw] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const fetchResumes = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getResumes();
      setResumes(list);
      const active = list.find((r) => r.isActive) || list[0] || null;
      setActiveResume(active);
      onActiveResumeChange?.(Boolean(active));
      if (active) {
        setTitle(active.title);
        setParsedResume(active.resume);
        const formatted = JSON.stringify(active.resume, null, 2);
        setJsonText(formatted);
        validateJson(formatted);
      } else {
        // Starter template conforming to JSON Resume v1.0.0
        const starter = {
          $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
          basics: {
            name: 'Your Name',
            label: 'Software Engineer',
            email: 'you@example.com',
            phone: '+1 555-0100',
            url: 'https://example.com',
            summary: 'Experienced developer specializing in scalable distributed systems.',
            location: { city: 'San Francisco', region: 'CA' },
          },
          skills: [
            { name: 'Languages', keywords: ['TypeScript', 'Python', 'Go', 'Rust'] },
            { name: 'Frameworks & Tools', keywords: ['React', 'Node.js', 'FastAPI', 'Docker'] },
          ],
          work: [
            {
              name: 'Tech Innovators Inc',
              position: 'Senior Backend Engineer',
              startDate: '2022-01-01',
              highlights: [
                'Engineered real-time data pipeline processing 50M events daily.',
                'Reduced query latency by 45% using Redis caching and index optimization.',
              ],
            },
          ],
        };
        setTitle('Master Resume');
        setParsedResume(starter);
        const formatted = JSON.stringify(starter, null, 2);
        setJsonText(formatted);
        validateJson(formatted);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to load resumes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchResumes();
  }, []);

  const validateJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      const isValid = schemaValidator(parsed);
      if (!isValid && schemaValidator.errors) {
        const errors = schemaValidator.errors.map(
          (schemaErr: ErrorObject) => `${schemaErr.instancePath || '/'} ${schemaErr.message}`
        );
        setValidationErrors(errors);
        return false;
      }
      setValidationErrors([]);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setValidationErrors([`JSON Syntax Error: ${msg}`]);
      return false;
    }
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    const isValid = validateJson(text);
    if (isValid) {
      try {
        setParsedResume(JSON.parse(text));
      } catch {
        // syntax error handled in validateJson
      }
    }
  };

  const handleFormChange = (updated: Record<string, unknown>) => {
    setParsedResume(updated);
    const formatted = JSON.stringify(updated, null, 2);
    setJsonText(formatted);
    validateJson(formatted);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleJsonChange(content);
      setTitle(file.name.replace(/\.json$/i, '') || 'Uploaded Resume');
    };
    reader.readAsText(file);
  };

  const handleRawFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawResumeText(content);
      setConvertError(null);
    };
    reader.readAsText(file);
  };

  const handleConvertRawResume = async () => {
    if (!rawResumeText.trim() || rawResumeText.trim().length < 20) {
      setConvertError('Please paste or upload at least a few lines of resume text.');
      return;
    }

    setConvertingRaw(true);
    setConvertError(null);
    try {
      const res = await api.parseResumeRaw({ text: rawResumeText.trim() });
      if (res.ok && res.resumeJson) {
        handleFormChange(res.resumeJson);
        if (res.resumeJson.basics?.name) {
          setTitle(`${res.resumeJson.basics.name} Resume`);
        }
        setShowAiConvertModal(false);
        setRawResumeText('');
        setSuccess(
          'Resume successfully converted to JSON Resume v1.0.0 via AI! Review and save below.'
        );
      } else {
        setConvertError('Failed to convert resume. Please check your AI Gateway configuration.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConvertError(
        msg || 'AI conversion failed. Please ensure your AI Gateway model is connected.'
      );
    } finally {
      setConvertingRaw(false);
    }
  };

  const handleSwitchToForm = () => {
    if (validationErrors.length > 0) {
      setError(
        'Cannot switch to form editor while JSON has syntax or schema errors. Please resolve them first.'
      );
      return;
    }
    setError(null);
    setEditorMode('form');
  };

  const handleSave = async (asNew: boolean = false) => {
    const isValid = validateJson(jsonText);
    if (!isValid) return;

    try {
      const parsed = JSON.parse(jsonText);
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (activeResume?.id && !asNew) {
        await api.patchResume(activeResume.id, {
          title: title.trim() || 'Master Resume',
          resumeJson: parsed,
        });
        if (!activeResume.isActive) {
          await api.setActiveResume(activeResume.id);
        }
        setSuccess('Resume updated in-place successfully!');
      } else {
        await api.uploadResume({
          title: title.trim() || 'Master Resume',
          resumeJson: parsed,
          setActive: true,
        });
        setSuccess('Resume saved and set as active master profile!');
      }

      await fetchResumes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to save resume');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchActive = async (id: string) => {
    try {
      await api.setActiveResume(id);
      await fetchResumes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to switch active resume');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      await api.deleteResume(id);
      await fetchResumes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to delete resume');
    }
  };

  const parsedActive = (activeResume?.resume ?? parsedResume) as ResumeData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Master Profile & Candidate Hub
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Built on the canonical{' '}
            <a
              href="https://jsonresume.org/schema/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-primary-light, #818cf8)' }}
            >
              JSON Resume v1.0.0 Specification
            </a>
            . Visual form editing for easy updates without touching raw JSON.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setShowAiConvertModal(true);
              setConvertError(null);
            }}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Sparkles size={15} /> AI Convert Raw Resume
          </button>

          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
            📁 Upload JSON Resume
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.875rem 1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '0.875rem 1rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#6ee7b7',
            fontSize: '0.85rem',
          }}
        >
          {success}
        </div>
      )}

      {/* Main Dual Grid: Active Preview / Versions + Visual Editor */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Active Profile Overview & Versions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Active Profile</h3>
              {activeResume && <span className="badge badge-success">Active Master</span>}
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading profile...
              </div>
            ) : Object.keys(parsedActive).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {parsedActive.basics?.name ?? 'Unnamed Candidate'}
                  </div>
                  <div
                    style={{
                      color: 'var(--color-primary-light, #818cf8)',
                      fontWeight: 500,
                      fontSize: '0.9rem',
                    }}
                  >
                    {parsedActive.basics?.label ?? 'No title'}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    {parsedActive.basics?.email}{' '}
                    {parsedActive.basics?.location?.city
                      ? `• ${parsedActive.basics.location.city}`
                      : ''}
                  </div>
                </div>

                {parsedActive.basics?.summary && (
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {parsedActive.basics.summary}
                  </div>
                )}

                {/* Extracted Role Keywords */}
                {(() => {
                  const keywords = extractKeywordsFromResume(parsedActive);
                  if (keywords.length === 0) return null;
                  return (
                    <div
                      style={{
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem 0.85rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          marginBottom: '0.45rem',
                        }}
                      >
                        <Tag size={13} /> Role Keywords ({keywords.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="badge"
                            style={{
                              fontSize: '0.72rem',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#e0e7ff',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Skills Preview */}
                {Array.isArray(parsedActive.skills) && parsedActive.skills.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: '0.45rem',
                      }}
                    >
                      Top Skills
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {parsedActive.skills
                        .flatMap((s: SkillItem) =>
                          Array.isArray(s.keywords) ? s.keywords : s.name ? [s.name] : []
                        )
                        .slice(0, 15)
                        .map((skill: string, idx: number) => (
                          <span
                            key={idx}
                            className="badge badge-neutral"
                            style={{ fontSize: '0.72rem' }}
                          >
                            {skill}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No master resume uploaded yet. Save the template on the right to get started!
              </div>
            )}

            {/* Saved versions list */}
            {resumes.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '0.85rem',
                  marginTop: '0.25rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Saved Profiles ({resumes.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {resumes.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.4rem 0.6rem',
                        background: r.isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: r.isActive ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '180px',
                        }}
                      >
                        {r.title}
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {!r.isActive && (
                          <button
                            type="button"
                            onClick={() => handleSwitchActive(r.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Form Editor / JSON Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Tab Header & Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleSwitchToForm}
                  className={`btn btn-sm ${editorMode === 'form' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <FileEdit size={14} /> Form Editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('json');
                  }}
                  className={`btn btn-sm ${editorMode === 'json' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Code2 size={14} /> Raw JSON
                </button>
              </div>

              <div>
                {validationErrors.length > 0 ? (
                  <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                    ❌ {validationErrors.length} Schema Error(s)
                  </span>
                ) : (
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    ✓ JSON Resume v1.0.0 Valid
                  </span>
                )}
              </div>
            </div>

            {/* Resume Title Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  marginBottom: '0.3rem',
                }}
              >
                Profile / Resume Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="input-text"
                style={{ height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Mode-specific Editor */}
            {editorMode === 'form' ? (
              <ResumeFormEditor resume={parsedResume} onChange={handleFormChange} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea
                  aria-label="Raw JSON Schema Content"
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="input-text"
                  rows={20}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                    resize: 'vertical',
                    whiteSpace: 'pre',
                    tabSize: 2,
                  }}
                  spellCheck={false}
                />
              </div>
            )}

            {validationErrors.length > 0 && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.6rem 0.8rem',
                  fontSize: '0.8rem',
                  color: '#fca5a5',
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  Schema Validation Issues:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.6rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '0.85rem',
              }}
            >
              {activeResume && (
                <button
                  type="button"
                  onClick={() => {
                    void handleSave(true);
                  }}
                  disabled={validationErrors.length > 0 || saving}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <PlusCircle size={14} /> Save as New Profile
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  void handleSave(false);
                }}
                disabled={validationErrors.length > 0 || saving}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.25rem',
                }}
              >
                <Save size={15} />
                {saving
                  ? 'Saving...'
                  : activeResume
                    ? 'Save Changes'
                    : 'Save & Activate Master Resume'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Facts Knowledge Store Panel */}
      <CandidateFactsPanel />

      {/* AI Convert Raw Resume Modal */}
      {showAiConvertModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !convertingRaw) {
              setShowAiConvertModal(false);
            }
          }}
        >
          <div
            className="settings-card"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
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
                <h3
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                  AI Resume Converter
                </h3>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                    marginBottom: 0,
                  }}
                >
                  Paste your plain text or Markdown resume, or select a file. The AI engine will
                  parse and structure it into standard JSON Resume v1.0.0.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiConvertModal(false)}
                disabled={convertingRaw}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            </div>

            {convertError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{convertError}</span>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Resume Text or Markdown
                </label>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                >
                  📁 Choose .txt or .md
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={handleRawFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <textarea
                value={rawResumeText}
                onChange={(e) => setRawResumeText(e.target.value)}
                placeholder="Paste your resume contents here (e.g. contact info, work history, skills, education)..."
                className="input-text"
                rows={12}
                disabled={convertingRaw}
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowAiConvertModal(false)}
                disabled={convertingRaw}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertRawResume}
                disabled={convertingRaw || !rawResumeText.trim()}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  minWidth: '150px',
                  justifyContent: 'center',
                }}
              >
                {convertingRaw ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Converting via AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Parse & Convert to JSON
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
