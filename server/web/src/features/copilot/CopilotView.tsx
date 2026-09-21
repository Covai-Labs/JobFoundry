import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  MessageSquare,
  FileText,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Layers,
} from 'lucide-react';
import {
  api,
  CopilotArtifacts,
} from '../../api/client';

interface CopilotViewProps {
  jobId: string;
  jobTitle?: string;
  company?: string;
}

const QA_SUGGESTIONS = [
  'Describe a time you resolved a critical production incident or distributed outage.',
  'Why do you want to join our engineering team in this role?',
  'Tell me about a complex legacy service or database migration you led.',
  'How do you manage trade-offs between technical debt and product delivery velocity?',
];

export const CopilotView: React.FC<CopilotViewProps> = ({ jobId, jobTitle, company }) => {
  const [activeTab, setActiveTab] = useState<'outreach' | 'qa' | 'cover_letter'>('outreach');
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<'outreach' | 'qa' | 'cover_letter' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Copilot Artifacts State
  const [artifacts, setArtifacts] = useState<CopilotArtifacts>({
    outreach: null,
    qa_history: [],
    cover_letter: null,
  });

  // Section inputs
  const [persona, setPersona] = useState<'recruiter' | 'hiring_manager'>('recruiter');
  const [qaInput, setQaInput] = useState<string>('');

  const fetchCopilotData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCopilotData(jobId);
      if (res.ok && res.data) {
        setArtifacts((prev) => ({
          outreach: prev.outreach || res.data.outreach || null,
          qa_history: prev.qa_history?.length ? prev.qa_history : (res.data.qa_history || []),
          cover_letter: prev.cover_letter || res.data.cover_letter || null,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Copilot data');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchCopilotData();
  }, [fetchCopilotData]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleGenerateOutreach = async () => {
    try {
      setGenerating('outreach');
      setError(null);
      const res = await api.generateCopilotOutreach(jobId, persona);
      if (res.ok && res.outreach) {
        setArtifacts((prev) => ({
          ...prev,
          outreach: res.outreach,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate recruiter outreach');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateQA = async (questionText?: string) => {
    const q = (questionText || qaInput).trim();
    if (!q) {
      setError('Please provide a question to answer');
      return;
    }
    try {
      setGenerating('qa');
      setError(null);
      const res = await api.generateCopilotQA(jobId, q);
      if (res.ok && res.qa) {
        setArtifacts((prev) => ({
          ...prev,
          qa_history: [res.qa, ...(prev.qa_history || [])],
        }));
        if (!questionText) {
          setQaInput('');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate interview answer');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateCoverLetter = async () => {
    try {
      setGenerating('cover_letter');
      setError(null);
      const res = await api.generateCopilotCoverLetter(jobId);
      if (res.ok && res.cover_letter) {
        setArtifacts((prev) => ({
          ...prev,
          cover_letter: res.cover_letter,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate tailored cover letter');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner / Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Application & Outreach Copilot
            </h4>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Grounded in your active Master Resume{jobTitle ? ` for ${jobTitle}` : ''}{company ? ` at ${company}` : ''}. Factual, anti-slop, and 1-click ready.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'var(--color-green-bg)',
              color: 'var(--color-green)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 500,
            }}
          >
            <ShieldCheck size={13} /> Strict Resume Grounding
          </span>
          <button
            onClick={fetchCopilotData}
            disabled={loading}
            title="Refresh Copilot artifacts"
            className="btn btn-sm btn-secondary"
            style={{ padding: '0.35rem 0.6rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: 'var(--color-red-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: 'var(--color-red)',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-red)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Copilot Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('outreach')}
          className={`btn btn-sm ${activeTab === 'outreach' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Send size={14} /> Recruiter Outreach
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`btn btn-sm ${activeTab === 'qa' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <MessageSquare size={14} /> Screening Q&A Assistant ({artifacts.qa_history?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('cover_letter')}
          className={`btn btn-sm ${activeTab === 'cover_letter' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <FileText size={14} /> Tailored Cover Letter
        </button>
      </div>

      {/* SUB-TAB 1: RECRUITER OUTREACH */}
      {activeTab === 'outreach' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Card */}
          <div
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target Persona:</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setPersona('recruiter')}
                  className={`btn btn-sm ${persona === 'recruiter' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                >
                  <UserCheck size={13} style={{ marginRight: '0.3rem' }} /> Recruiter / Talent Lead
                </button>
                <button
                  type="button"
                  onClick={() => setPersona('hiring_manager')}
                  className={`btn btn-sm ${persona === 'hiring_manager' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                >
                  <Layers size={13} style={{ marginRight: '0.3rem' }} /> Engineering / Hiring Mgr
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerateOutreach}
              disabled={generating === 'outreach'}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {generating === 'outreach' ? (
                <>
                  <RefreshCw size={15} className="spin" /> Drafting Outreach...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Generate Outreach Notes
                </>
              )}
            </button>
          </div>

          {/* Outreach Content */}
          {artifacts.outreach ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {/* LinkedIn Connection Note */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      LinkedIn Connection Note
                    </span>
                    {/* Tier badges */}
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        background:
                          artifacts.outreach.connection_note_char_count <= 200
                            ? 'var(--color-green-bg)'
                            : 'var(--color-amber-bg)',
                        color:
                          artifacts.outreach.connection_note_char_count <= 200
                            ? 'var(--color-green)'
                            : 'var(--color-amber)',
                        border: `1px solid ${
                          artifacts.outreach.connection_note_char_count <= 200
                            ? 'rgba(16, 185, 129, 0.4)'
                            : 'rgba(245, 158, 11, 0.4)'
                        }`,
                      }}
                    >
                      {artifacts.outreach.connection_note_char_count <= 200
                        ? 'Free Tier (<200)'
                        : 'Premium Tier (<300)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color:
                          artifacts.outreach.connection_note_char_count <= 200
                            ? 'var(--color-green)'
                            : artifacts.outreach.connection_note_char_count <= 300
                            ? 'var(--color-amber)'
                            : 'var(--color-red)',
                        fontWeight: 600,
                      }}
                    >
                      {artifacts.outreach.connection_note_char_count} / 300 chars
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(artifacts.outreach!.connection_note, 'conn_note')
                      }
                      className="btn btn-sm btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      {copiedKey === 'conn_note' ? (
                        <>
                          <Check size={14} color="var(--color-green)" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copy Note
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {artifacts.outreach.connection_note}
                </div>
              </div>

              {/* LinkedIn InMail Draft */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    InMail / Direct Message Draft
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Subject: ${artifacts.outreach!.inmail_subject}\n\n${artifacts.outreach!.inmail_body}`,
                        'inmail_all'
                      )
                    }
                    className="btn btn-sm btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {copiedKey === 'inmail_all' ? (
                      <>
                        <Check size={14} color="var(--color-green)" /> Copied All!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Subject & Body
                      </>
                    )}
                  </button>
                </div>

                {/* Subject */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.85rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Subject:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {artifacts.outreach.inmail_subject}
                    </strong>
                  </div>
                  <button
                    onClick={() => copyToClipboard(artifacts.outreach!.inmail_subject, 'inmail_subj')}
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    {copiedKey === 'inmail_subj' ? <Check size={12} color="var(--color-green)" /> : <Copy size={12} />}
                  </button>
                </div>

                {/* Body */}
                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {artifacts.outreach.inmail_body}
                </div>

                {/* Matched Projects Evidence */}
                {artifacts.outreach.matched_projects?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Resume Projects Referenced:
                    </span>
                    {artifacts.outreach.matched_projects.map((proj, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        {proj}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                background: 'var(--bg-glass)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
              }}
            >
              <Send size={32} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                No outreach drafts generated yet.
              </p>
              <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Pick your target persona above and click "Generate Outreach Notes" for 1-click ready LinkedIn notes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SCREENING Q&A ASSISTANT */}
      {activeTab === 'qa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Input & Suggestions */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Application / Screening Question
            </label>
            <textarea
              rows={3}
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              placeholder="Paste any question from the application form (e.g. 'Describe a challenging engineering failure you handled', 'Why do you want to work here?')..."
              className="text-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.875rem',
                lineHeight: '1.4',
                fontFamily: 'var(--font-sans)',
              }}
            />

            {/* Quick Suggestion Chips */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Quick questions to test:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {QA_SUGGESTIONS.map((sugg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setQaInput(sugg);
                      handleGenerateQA(sugg);
                    }}
                    className="btn btn-sm btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    + {sugg}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => handleGenerateQA()}
                disabled={generating === 'qa' || !qaInput.trim()}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {generating === 'qa' ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Formulating Response...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Generate Grounded Answer
                  </>
                )}
              </button>
            </div>
          </div>

          {/* QA History & Cards */}
          {artifacts.qa_history && artifacts.qa_history.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {artifacts.qa_history.map((qaItem, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: 'var(--accent-primary)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        Q#{artifacts.qa_history.length - idx}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {qaItem.question}
                      </strong>
                    </div>

                    <button
                      onClick={() => copyToClipboard(qaItem.answer, `qa_${idx}`)}
                      className="btn btn-sm btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      {copiedKey === `qa_${idx}` ? (
                        <>
                          <Check size={14} color="var(--color-green)" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copy Answer
                        </>
                      )}
                    </button>
                  </div>

                  {/* Main Answer */}
                  <div
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.9rem 1rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {qaItem.answer}
                  </div>

                  {/* STAR Structure Breakdown if present */}
                  {qaItem.star_structure && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      {qaItem.star_structure.situation && (
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <strong style={{ color: 'var(--accent-primary)', display: 'block' }}>Situation:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{qaItem.star_structure.situation}</span>
                        </div>
                      )}
                      {qaItem.star_structure.task && (
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <strong style={{ color: 'var(--accent-primary)', display: 'block' }}>Task:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{qaItem.star_structure.task}</span>
                        </div>
                      )}
                      {qaItem.star_structure.action && (
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <strong style={{ color: 'var(--accent-primary)', display: 'block' }}>Action:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{qaItem.star_structure.action}</span>
                        </div>
                      )}
                      {qaItem.star_structure.result && (
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <strong style={{ color: 'var(--color-green)', display: 'block' }}>Result:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{qaItem.star_structure.result}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matched Evidence */}
                  {qaItem.matched_evidence && qaItem.matched_evidence.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resume Evidence:</span>
                      {qaItem.matched_evidence.map((ev, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.72rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: 'var(--color-green)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                          }}
                        >
                          ✓ {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                background: 'var(--bg-glass)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
              }}
            >
              <MessageSquare size={32} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                No screening questions answered yet.
              </p>
              <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Paste questions from your job application to get articulate answers grounded in your real projects.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: TAILORED COVER LETTER */}
      {activeTab === 'cover_letter' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Card */}
          <div
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  3-Paragraph Executive Letter
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  Anti-Buzzword Clean
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Hook, concrete project metrics, and role alignment without AI cliches.
              </span>
            </div>

            <button
              onClick={handleGenerateCoverLetter}
              disabled={generating === 'cover_letter'}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {generating === 'cover_letter' ? (
                <>
                  <RefreshCw size={15} className="spin" /> Drafting Cover Letter...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Generate Cover Letter
                </>
              )}
            </button>
          </div>

          {/* Letter Content */}
          {artifacts.cover_letter ? (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Tailored Cover Letter
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {artifacts.cover_letter.word_count} words
                  </span>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(artifacts.cover_letter!.cover_letter, 'cover_letter')
                  }
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {copiedKey === 'cover_letter' ? (
                    <>
                      <Check size={14} color="var(--color-green)" /> Copied Letter!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Full Letter
                    </>
                  )}
                </button>
              </div>

              {/* Cover Letter Body */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1.25rem 1.5rem',
                  fontSize: '0.9rem',
                  lineHeight: '1.7',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {artifacts.cover_letter.cover_letter}
              </div>

              {/* Paragraph Breakdown */}
              {artifacts.cover_letter.paragraph_breakdown && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Structural Breakdown:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '0.25rem' }}>
                        1. Hook & Alignment
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {artifacts.cover_letter.paragraph_breakdown.hook}
                      </p>
                    </div>

                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.75rem', color: 'var(--color-green)', display: 'block', marginBottom: '0.25rem' }}>
                        2. Core Proof / Projects
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {artifacts.cover_letter.paragraph_breakdown.evidence}
                      </p>
                    </div>

                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.75rem', color: 'var(--color-amber)', display: 'block', marginBottom: '0.25rem' }}>
                        3. Value & Closing
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {artifacts.cover_letter.paragraph_breakdown.alignment}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Skills highlighted */}
              {artifacts.cover_letter.highlighted_skills?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skills Highlighted:</span>
                  {artifacts.cover_letter.highlighted_skills.map((skill, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.72rem',
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--accent-primary)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                background: 'var(--bg-glass)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
              }}
            >
              <FileText size={32} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                No cover letter generated yet.
              </p>
              <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Click "Generate Cover Letter" to craft an articulate, clean 3-paragraph letter free of AI fluff.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
