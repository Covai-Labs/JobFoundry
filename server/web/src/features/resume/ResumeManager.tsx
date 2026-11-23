/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Eye,
  CheckCircle2,
  UploadCloud,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderGit2,
  User,
  Download,
} from 'lucide-react';
import { api, UserResume } from '../../api/client';
import resumeSchema from './resume-schema.json';
import { extractKeywordsFromResume } from '../../lib/resumeKeywords';
import { ResumeFormEditor } from './ResumeFormEditor';
import { STARTER_RESUME_TEMPLATE, ResumeData, SkillItem, WorkItem } from './resumeTypes';
import { CandidateFactsPanel } from './CandidateFactsPanel';
import { ThemePreviewGallery } from './ThemePreviewGallery';
import { findThemeMetadata } from './themeCatalog';

const AjvClass = (Ajv as any).default || Ajv;
const addFormatsFn = (addFormats as any).default || addFormats;

const ajv = new AjvClass({ strict: false, allErrors: true, validateSchema: false });
addFormatsFn(ajv);
const schemaValidator = ajv.compile(resumeSchema);

export interface ResumeManagerProps {
  onActiveResumeChange?: (hasActive: boolean) => void;
  onThemeChange?: (_theme: string) => void;
}

export const ResumeManager: React.FC<ResumeManagerProps> = ({
  onActiveResumeChange,
  onThemeChange,
}) => {
  const [resumes, setResumes] = useState<UserResume[]>([]);
  const [activeResume, setActiveResume] = useState<UserResume | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editor states
  const [editorMode, setEditorMode] = useState<'overview' | 'form' | 'json' | 'preview'>('form');
  const [title, setTitle] = useState<string>('Master Resume');
  const [jsonText, setJsonText] = useState<string>('');
  const [initialJsonText, setInitialJsonText] = useState<string>('');
  const [parsedResume, setParsedResume] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  // Theme states
  const [activeTheme, setActiveTheme] = useState<string>('jsonresume-theme-folio');
  const [selectedTheme, setSelectedTheme] = useState<string>('jsonresume-theme-folio');
  const [savingDefaultTheme, setSavingDefaultTheme] = useState<boolean>(false);

  // Theme preview states (blob URLs, because the PDF is fetched with an
  // Authorization header and iframes cannot send one)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const previewBlob = useRef<{ theme: string; blob: Blob } | null>(null);

  // AI Raw Resume Converter states
  const [showAiConvertModal, setShowAiConvertModal] = useState<boolean>(false);
  const [convertStep, setConvertStep] = useState<'input' | 'review'>('input');
  const [rawResumeText, setRawResumeText] = useState<string>('');
  const [convertingRaw, setConvertingRaw] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [extractedResume, setExtractedResume] = useState<ResumeData | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loadedFile, setLoadedFile] = useState<{ name: string; size: string } | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [showRawExtractedJson, setShowRawExtractedJson] = useState<boolean>(false);
  const [savingAsNew, setSavingAsNew] = useState<boolean>(false);
  const readSequenceIdRef = useRef<number>(0);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setSuccess(null);
    }, 8000);
    return () => {
      clearTimeout(timer);
    };
  }, [success]);

  const fetchResumes = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getResumes();
      setResumes(list);
      const active = list.length > 0 ? (list.find((r) => r.isActive) ?? list[0]) : null;
      setActiveResume(active);
      onActiveResumeChange?.(Boolean(active));
      if (active) {
        setTitle(active.title);
        setParsedResume(active.resume);
        const formatted = JSON.stringify(active.resume, null, 2);
        setJsonText(formatted);
        setInitialJsonText(formatted);
        validateJson(formatted);
      } else {
        setTitle('Master Resume');
        setParsedResume(STARTER_RESUME_TEMPLATE);
        const formatted = JSON.stringify(STARTER_RESUME_TEMPLATE, null, 2);
        setJsonText(formatted);
        setInitialJsonText(formatted);
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
    api
      .getSettings()
      .then((s) => {
        const theme = s.settings.tailor_theme;
        if (theme) {
          setActiveTheme(theme);
          setSelectedTheme(theme);
        }
      })
      .catch(() => {
        // Ignore settings load errors on initial mount
      });
  }, []);

  const loadThemePreview = useCallback(
    async (themeSlug: string) => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const blob = await api.getMasterResumePreviewPdf(themeSlug, parsedResume);
        const url = window.URL.createObjectURL(blob);
        if (previewObjectUrl.current) window.URL.revokeObjectURL(previewObjectUrl.current);
        previewObjectUrl.current = url;
        previewBlob.current = { theme: themeSlug, blob };
        setPreviewUrl(url);
      } catch (err: unknown) {
        previewBlob.current = null;
        setPreviewUrl(null);
        setPreviewError(err instanceof Error ? err.message : String(err));
      } finally {
        setPreviewLoading(false);
      }
    },
    [parsedResume]
  );

  useEffect(() => {
    if (editorMode !== 'preview' || validationErrors.length > 0) return;
    void loadThemePreview(selectedTheme);
  }, [editorMode, selectedTheme, loadThemePreview, validationErrors.length]);

  useEffect(
    () => () => {
      if (previewObjectUrl.current) window.URL.revokeObjectURL(previewObjectUrl.current);
    },
    []
  );

  const handleSetDefaultTheme = async (themeSlug: string) => {
    setSavingDefaultTheme(true);
    setError(null);
    try {
      await api.updateSettings({ tailor_theme: themeSlug });
      setActiveTheme(themeSlug);
      onThemeChange?.(themeSlug);
      const meta = findThemeMetadata(themeSlug);
      setSuccess(`Set ${meta?.name ?? themeSlug} as default theme!`);
      setTimeout(() => {
        setSuccess(null);
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to update default theme');
    } finally {
      setSavingDefaultTheme(false);
    }
  };

  const safeFilenamePart = (value: string) =>
    value.replace(/[^a-z0-9._ -]+/gi, '_').trim() || 'Resume';

  const handleDownloadPreviewPdf = async (themeSlug: string) => {
    try {
      const cached = previewBlob.current;
      const blob =
        cached && cached.theme === themeSlug
          ? cached.blob
          : await api.getMasterResumePreviewPdf(themeSlug, parsedResume);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const meta = findThemeMetadata(themeSlug);
      a.download = `${safeFilenamePart(title || 'Master-Resume')}-${meta?.name ?? themeSlug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to download preview PDF');
    }
  };

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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processResumeFile = async (file: File) => {
    const readSeq = ++readSequenceIdRef.current;
    const isJson = file.name.endsWith('.json') || file.type === 'application/json';
    const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';
    const isText =
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.type.startsWith('text/') ||
      file.type === '';

    if (!isJson && !isPdf && !isText) {
      setConvertError('Unsupported file type. Please upload a .pdf, .txt, .md, or .json file.');
      return;
    }

    if (isPdf) {
      try {
        setIsExtractingPdf(true);
        setConvertError(null);
        const { extractText } = await import('unpdf');
        const arrayBuffer = await file.arrayBuffer();
        if (readSeq !== readSequenceIdRef.current) return;
        const result = await extractText(new Uint8Array(arrayBuffer));
        if (readSeq !== readSequenceIdRef.current) return;
        const text = Array.isArray(result.text) ? result.text.join('\n\n') : result.text || '';
        if (!text.trim()) {
          setConvertError(
            'No selectable text found in PDF. If this is a scanned document/image, please paste the text directly.'
          );
          return;
        }
        setRawResumeText(text);
        setLoadedFile({ name: file.name, size: formatFileSize(file.size) });
        setConvertError(null);
      } catch (err: unknown) {
        if (readSeq !== readSequenceIdRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setConvertError(`Failed to extract text from PDF: ${msg}`);
      } finally {
        if (readSeq === readSequenceIdRef.current) {
          setIsExtractingPdf(false);
        }
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (readSeq !== readSequenceIdRef.current) return;
      const content = (event.target?.result as string) || '';
      if (isJson) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') {
            const isValid = schemaValidator(parsed);
            if (isValid) {
              setExtractedResume(parsed as ResumeData);
              setLoadedFile({ name: file.name, size: formatFileSize(file.size) });
              setRawResumeText(content);
              setConvertStep('review');
              setConvertError(null);
              return;
            }
            const schemaIssues = schemaValidator.errors
              ? schemaValidator.errors
                  .map((e: ErrorObject) => `${e.instancePath || 'root'}: ${e.message}`)
                  .join('; ')
              : 'Uploaded file is not a valid JSON Resume v1.0.0.';
            setConvertError(`Invalid JSON Resume schema: ${schemaIssues}`);
            setRawResumeText(content);
            setLoadedFile({ name: file.name, size: formatFileSize(file.size) });
            return;
          }
        } catch {
          // If JSON parsing fails, fall back to setting raw text
        }
      }
      setRawResumeText(content);
      setLoadedFile({ name: file.name, size: formatFileSize(file.size) });
      setConvertError(null);
    };
    reader.readAsText(file);
  };

  const handleRawFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void processResumeFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processResumeFile(file);
    }
  };

  const getDropzoneTitle = (): string => {
    if (isExtractingPdf) return 'Extracting text from PDF...';
    if (isDragging) return 'Drop PDF, text, or markdown file here...';
    if (loadedFile) return `File Loaded: ${loadedFile.name}`;
    return 'Drag & drop PDF, Markdown, or text file';
  };

  const getDropzoneSubtitle = (): string => {
    if (isExtractingPdf) return 'Reading document pages via client-side PDF parser';
    if (loadedFile) return `Size: ${loadedFile.size}`;
    return 'Supports .pdf, .txt, .md, or .json files';
  };

  const getModalSubtitle = (): string => {
    if (convertStep === 'review') {
      return 'Successfully structured according to JSON Resume v1.0.0. Inspect extracted details before applying.';
    }
    return 'Paste your plain text or Markdown resume, or drop a file. The AI engine will parse and structure it into standard JSON Resume v1.0.0.';
  };

  const extractSkillTokens = (skills?: unknown[]): string[] => {
    if (!Array.isArray(skills)) return [];
    return skills
      .filter((s): s is SkillItem => Boolean(s && typeof s === 'object'))
      .flatMap((s) => {
        if (Array.isArray(s.keywords)) {
          const validKeywords = s.keywords.filter((k): k is string => typeof k === 'string');
          return s.name ? [s.name, ...validKeywords] : validKeywords;
        }
        return s.name ? [s.name] : [];
      })
      .filter(Boolean)
      .slice(0, 15);
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
        const parsedResume = res.resumeJson as ResumeData;
        setExtractedResume(parsedResume);
        setConvertStep('review');
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

  const handleApplyExtracted = () => {
    if (!extractedResume) return;
    if (initialJsonText && jsonText !== initialJsonText) {
      if (
        !window.confirm(
          'You have unsaved changes in the editor. Applying this resume will overwrite them. Continue?'
        )
      ) {
        return;
      }
    }
    handleFormChange(extractedResume);
    if (extractedResume.basics?.name) {
      setTitle(`${extractedResume.basics.name} Resume`);
    }
    setShowAiConvertModal(false);
    setRawResumeText('');
    setLoadedFile(null);
    setExtractedResume(null);
    setConvertStep('input');
    setSuccess(
      'Converted resume applied to editor! Review your sections and click Save Changes to persist.'
    );
  };

  const handleSaveExtractedAsNew = async () => {
    if (!extractedResume) return;
    try {
      setSavingAsNew(true);
      setConvertError(null);
      const resumeTitle = extractedResume.basics?.name
        ? `${extractedResume.basics.name} Resume`
        : 'Master Resume';
      await api.uploadResume({
        title: resumeTitle,
        resumeJson: extractedResume,
        setActive: false,
      });
      setShowAiConvertModal(false);
      setRawResumeText('');
      setLoadedFile(null);
      setExtractedResume(null);
      setConvertStep('input');
      setSuccess(`Saved "${resumeTitle}" as a new profile in your library!`);
      await fetchResumes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConvertError(msg || 'Failed to save new resume profile.');
    } finally {
      setSavingAsNew(false);
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

  const handleExportJson = () => {
    try {
      const exportData =
        Object.keys(parsedResume).length > 0
          ? (parsedResume as ResumeData)
          : ((activeResume?.resume ?? {}) as ResumeData);
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      const fileName = (exportData.basics?.name ?? title ?? 'master_resume')
        .toLowerCase()
        .replace(/\s+/g, '_');
      downloadAnchor.setAttribute('download', `${fileName}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setSuccess('Exported master resume JSON successfully!');
    } catch {
      setError('Failed to export JSON resume');
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

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setShowAiConvertModal(true);
              setConvertStep('input');
              setConvertError(null);
              setExtractedResume(null);
            }}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            title="Paste unformatted text, old PDF text dump, or LinkedIn profile. AI will parse and map it into the JSON Resume schema."
            aria-label="Smart Resume Import (AI Convert Raw Resume)"
          >
            <Sparkles size={15} /> Smart Resume Import
          </button>

          <label
            className="btn btn-secondary btn-sm"
            style={{
              cursor: 'pointer',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Upload a standardized JSON Resume (.json) file compliant with JSON Resume v1.0.0 specification"
          >
            <span>📁 Upload JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={loading || validationErrors.length > 0}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title={
              validationErrors.length > 0
                ? 'Resolve validation errors before exporting'
                : 'Download active master resume as standard JSON file'
            }
          >
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--color-red-bg, rgba(239, 68, 68, 0.12))',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-red, #dc2626)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
            }}
            className="btn btn-secondary btn-xs"
            style={{
              padding: '0.15rem 0.4rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <output
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--color-green-bg, rgba(16, 185, 129, 0.12))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-green, #059669)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
            }}
            className="btn btn-secondary btn-xs"
            style={{
              padding: '0.15rem 0.4rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </output>
      )}

      {/* Sub-Navigation & Global Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: '72px',
          zIndex: 10,
          background: 'var(--bg-card)',
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Navigation Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setEditorMode('overview')}
            className={`btn btn-sm ${editorMode === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="View candidate overview, role keywords, top skills, and manage saved profile versions"
          >
            <User size={14} /> Active Profile
          </button>

          <button
            type="button"
            onClick={handleSwitchToForm}
            className={`btn btn-sm ${editorMode === 'form' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Visual form editing with organized sections for basics, work, education, and skills"
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
            title="Direct code editor for canonical JSON Resume v1.0.0 schema"
          >
            <Code2 size={14} /> Raw JSON
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorMode('preview');
            }}
            className={`btn btn-sm ${editorMode === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            disabled={validationErrors.length > 0}
            title={
              validationErrors.length > 0
                ? 'Resolve schema validation errors to preview themes'
                : 'Preview master resume across 14 curated themes with live PDF render'
            }
          >
            <Eye size={14} /> Theme Preview
          </button>

          {/* Validation Status Badge */}
          {validationErrors.length > 0 ? (
            <span
              className="badge badge-danger"
              style={{ fontSize: '0.75rem', cursor: 'help' }}
              title="Click or view below to review validation errors against JSON Resume v1.0.0 specification"
            >
              ❌ {validationErrors.length} Schema Error(s)
            </span>
          ) : (
            <span
              className="badge badge-success"
              style={{ fontSize: '0.75rem', cursor: 'help' }}
              title="Passed canonical JSON Resume v1.0.0 schema validation"
            >
              ✓ JSON Resume v1.0.0 Valid
            </span>
          )}
        </div>

        {/* Global Save Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              void handleSave(false);
            }}
            disabled={saving || validationErrors.length > 0}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
            }}
            title="Save changes to active master resume"
          >
            <Save size={14} />
            {saving ? 'Saving...' : activeResume ? 'Save Changes' : 'Save & Activate'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div
          className="card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}
        >
          Loading profile...
        </div>
      ) : editorMode === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Active Profile Overview Card */}
          <div
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}
          >
            {Object.keys(parsedActive).length > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), #818cf8)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        boxShadow: 'var(--shadow-sm)',
                        flexShrink: 0,
                      }}
                    >
                      {(parsedActive.basics?.name ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                          {parsedActive.basics?.name ?? 'Unnamed Candidate'}
                        </h3>
                        {activeResume && <span className="badge badge-success">Active Master</span>}
                      </div>
                      <div
                        style={{
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          marginTop: '0.2rem',
                        }}
                      >
                        {parsedActive.basics?.label ?? 'No professional headline set'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleSwitchToForm}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      title="Edit resume details in the visual form builder"
                    >
                      <FileEdit size={14} /> Edit in Form Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('preview')}
                      disabled={validationErrors.length > 0}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      title="View rendered PDF and choose themes"
                    >
                      <Eye size={14} /> Theme & PDF Preview
                    </button>
                  </div>
                </div>

                {/* Contact & Location Strip */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {parsedActive.basics?.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                      <a
                        href={`mailto:${parsedActive.basics.email}`}
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        {parsedActive.basics.email}
                      </a>
                    </div>
                  )}
                  {parsedActive.basics?.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                      <span>{parsedActive.basics.phone}</span>
                    </div>
                  )}
                  {Boolean(
                    parsedActive.basics?.location?.city ?? parsedActive.basics?.location?.region
                  ) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Location:</span>
                      <span>
                        {[parsedActive.basics.location.city, parsedActive.basics.location.region]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {parsedActive.basics?.url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Portfolio / URL:</span>
                      <a
                        href={parsedActive.basics.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        {parsedActive.basics.url}
                      </a>
                    </div>
                  )}
                </div>

                {/* Professional Summary */}
                {parsedActive.basics?.summary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Professional Summary
                    </div>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        background: 'var(--bg-card)',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {parsedActive.basics.summary}
                    </div>
                  </div>
                )}

                {/* Role Keywords & Top Skills Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {/* Extracted Role Keywords */}
                  {(() => {
                    const keywords = extractKeywordsFromResume(parsedActive);
                    return (
                      <div
                        style={{
                          background: 'rgba(99, 102, 241, 0.06)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem 1rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: 'var(--accent-primary)',
                            marginBottom: '0.6rem',
                          }}
                        >
                          <Tag size={14} /> Role Keywords ({keywords.length})
                        </div>
                        {keywords.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {keywords.map((kw, idx) => (
                              <span
                                key={idx}
                                className="badge badge-indigo"
                                style={{ fontSize: '0.75rem' }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No role keywords detected yet.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Top Skills Preview */}
                  <div
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: '0.6rem',
                      }}
                    >
                      Top Skills (
                      {Array.isArray(parsedActive.skills) ? parsedActive.skills.length : 0} groups)
                    </div>
                    {Array.isArray(parsedActive.skills) && parsedActive.skills.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {parsedActive.skills
                          .flatMap((s: SkillItem) =>
                            Array.isArray(s.keywords) && s.keywords.length > 0
                              ? s.keywords
                              : s.name
                                ? [s.name]
                                : []
                          )
                          .slice(0, 20)
                          .map((skill: string, idx: number) => (
                            <span
                              key={idx}
                              className="badge badge-neutral"
                              style={{ fontSize: '0.75rem' }}
                            >
                              {skill}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        No skills listed yet.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ margin: '0 0 1rem 0' }}>
                  No master resume uploaded yet. Save the template or import with AI to get started!
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSwitchToForm}
                    className="btn btn-primary btn-sm"
                  >
                    Open Form Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiConvertModal(true);
                      setConvertStep('input');
                      setConvertError(null);
                      setExtractedResume(null);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <Sparkles size={14} /> Smart Resume Import
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Profiles & Versions Section */}
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Saved Profiles ({resumes.length})
                </h4>
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    margin: '0.2rem 0 0 0',
                  }}
                >
                  Manage alternate resume versions and select which is the active master profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleSave(true);
                }}
                disabled={validationErrors.length > 0 || saving}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Fork current resume into a new saved profile version"
              >
                <PlusCircle size={14} /> Save as New Profile
              </button>
            </div>

            {resumes.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      background: r.isActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
                      border: `1px solid ${r.isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: r.isActive ? 600 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '170px',
                          }}
                        >
                          {r.title}
                        </span>
                        {r.isActive && (
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {r.updatedAt
                          ? `Updated ${new Date(r.updatedAt).toLocaleDateString()}`
                          : 'Master version'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.35rem',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {!r.isActive && (
                        <button
                          type="button"
                          onClick={() => handleSwitchActive(r.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                          title="Make this profile the active master resume"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        title="Delete this profile version"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '1rem',
                }}
              >
                No saved profile versions yet.
              </div>
            )}
          </div>
        </div>
      ) : editorMode === 'preview' ? (
        <div className="card" style={{ padding: '1.5rem' }}>
          <ThemePreviewGallery
            activeTheme={activeTheme}
            selectedTheme={selectedTheme}
            onSelectTheme={setSelectedTheme}
            onSetDefaultTheme={handleSetDefaultTheme}
            previewPdfUrl={previewUrl}
            previewLoading={previewLoading}
            previewError={previewError}
            onRetryPreview={() => {
              void loadThemePreview(selectedTheme);
            }}
            onDownloadPdf={handleDownloadPreviewPdf}
            isSavingDefault={savingDefaultTheme}
          />
        </div>
      ) : (
        /* Visual Form Editor OR Raw JSON Editor (Full Width) */
        <div
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}
        >
          {/* Active Context Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.6rem 0.9rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Editing Profile:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {parsedActive.basics?.name ?? title}
              </strong>
              {activeResume && (
                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                  Active Master
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditorMode('overview')}
              className="btn btn-secondary btn-xs"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              title="View the active profile summary, keywords, and saved versions"
            >
              <User size={13} /> View Active Profile Card →
            </button>
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

          {/* Mode Content */}
          {editorMode === 'form' ? (
            <ResumeFormEditor resume={parsedResume} onChange={handleFormChange} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <textarea
                aria-label="Raw JSON Schema Content"
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="input-text"
                rows={22}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  resize: 'vertical',
                  whiteSpace: 'pre',
                  tabSize: 2,
                }}
                spellCheck={false}
              />
            </div>
          )}

          {/* Validation Issues Alert */}
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

          {/* Footer Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '0.6rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '0.85rem',
              flexWrap: 'wrap',
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
                title="Save current details as a new profile and make it the active master"
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
              title="Save changes to active master resume"
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
      )}

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
            if (e.target === e.currentTarget && !convertingRaw && !savingAsNew) {
              setShowAiConvertModal(false);
            }
          }}
        >
          <div
            className="settings-card"
            style={{
              width: '100%',
              maxWidth: convertStep === 'review' ? '740px' : '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              transition: 'max-width 0.2s ease-in-out',
            }}
          >
            {/* Modal Header */}
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
                  {convertStep === 'review' ? (
                    <>
                      <CheckCircle2 size={18} style={{ color: 'var(--color-green, #10b981)' }} />
                      Review Converted Resume
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                      AI Resume Converter
                    </>
                  )}
                </h3>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                    marginBottom: 0,
                  }}
                >
                  {getModalSubtitle()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiConvertModal(false)}
                disabled={convertingRaw || savingAsNew}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {convertError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--color-red-bg, rgba(239, 68, 68, 0.15))',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-red, #dc2626)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{convertError}</span>
              </div>
            )}

            {convertingRaw ? (
              /* Converting Progress Stepper */
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: 'var(--accent-primary)',
                    marginBottom: '1rem',
                  }}
                >
                  <RefreshCw size={24} className="animate-spin" />
                </div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                  Structuring Resume with AI...
                </h4>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    maxWidth: '440px',
                    margin: '0 auto 1.75rem auto',
                    lineHeight: 1.45,
                  }}
                >
                  Extracting candidate profile, employment history, degrees, and skills into
                  standard JSON Resume Draft-07 format.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    maxWidth: '380px',
                    margin: '0 auto',
                    textAlign: 'left',
                    background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ color: 'var(--color-green, #10b981)' }} />
                    <span>Normalized input text & formatting</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.82rem',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Extracting work history, education & skills</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        border: '2px solid var(--border-subtle)',
                      }}
                    />
                    <span>Validating against JSON Resume schema</span>
                  </div>
                </div>
              </div>
            ) : convertStep === 'review' && extractedResume ? (
              /* Review Extracted Resume Step */
              <div>
                {/* Candidate Overview Card */}
                <div
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                  }}
                >
                  {(() => {
                    const basics = extractedResume.basics;
                    const location = basics?.location;
                    const locationString = [location?.city, location?.region, location?.countryCode]
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {basics?.name ?? 'Unnamed Candidate'}
                            </div>
                            {basics?.label && (
                              <div
                                style={{
                                  color: 'var(--accent-primary)',
                                  fontSize: '0.9rem',
                                  fontWeight: 500,
                                  marginTop: '0.15rem',
                                }}
                              >
                                {basics.label}
                              </div>
                            )}
                          </div>
                          <span className="badge badge-success">✓ Schema Validated</span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            marginTop: '0.45rem',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {basics?.email && <span>✉️ {basics.email}</span>}
                          {basics?.phone && <span>📞 {basics.phone}</span>}
                          {Boolean(locationString) && <span>📍 {locationString}</span>}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 4 Stat Badges Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.6rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    className="card"
                    style={{
                      padding: '0.65rem',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Briefcase size={14} style={{ color: 'var(--accent-primary)' }} />
                      {extractedResume.work?.length ?? 0}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                      }}
                    >
                      Work Roles
                    </div>
                  </div>

                  <div
                    className="card"
                    style={{
                      padding: '0.65rem',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <GraduationCap size={15} style={{ color: 'var(--color-blue, #3b82f6)' }} />
                      {extractedResume.education?.length ?? 0}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                      }}
                    >
                      Education
                    </div>
                  </div>

                  <div
                    className="card"
                    style={{
                      padding: '0.65rem',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Wrench size={14} style={{ color: 'var(--color-purple, #8b5cf6)' }} />
                      {extractedResume.skills?.length ?? 0}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                      }}
                    >
                      Skill Groups
                    </div>
                  </div>

                  <div
                    className="card"
                    style={{
                      padding: '0.65rem',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <FolderGit2 size={14} style={{ color: 'var(--color-amber, #f59e0b)' }} />
                      {extractedResume.projects?.length ?? 0}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                      }}
                    >
                      Projects
                    </div>
                  </div>
                </div>

                {/* Extracted Details Scroll Box */}
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    padding: '0.85rem',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                  }}
                >
                  {extractedResume.basics?.summary && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontSize: '0.72rem',
                          marginBottom: '0.2rem',
                        }}
                      >
                        Summary
                      </div>
                      <p
                        style={{
                          margin: 0,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.45,
                          fontSize: '0.8rem',
                        }}
                      >
                        {extractedResume.basics.summary}
                      </p>
                    </div>
                  )}

                  {Array.isArray(extractedResume.work) && extractedResume.work.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontSize: '0.72rem',
                          marginBottom: '0.3rem',
                        }}
                      >
                        Experience Highlights
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {extractedResume.work.slice(0, 3).map((job: WorkItem, idx: number) => (
                          <div
                            key={job.name ? `${job.name}-${idx}` : `job-${idx}`}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {job.position ?? 'Role'}{' '}
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                at {job.name ?? 'Company'}
                              </span>
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {job.startDate ?? ''} – {job.endDate ?? 'Present'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(extractedResume.skills) && extractedResume.skills.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontSize: '0.72rem',
                          marginBottom: '0.3rem',
                        }}
                      >
                        Extracted Skills
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {extractSkillTokens(extractedResume.skills).map(
                          (skill: string, idx: number) => (
                            <span
                              key={`${skill}-${idx}`}
                              className="badge badge-indigo"
                              style={{ fontSize: '0.72rem' }}
                            >
                              {skill}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inspect JSON Output Toggle */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRawExtractedJson((prev) => !prev);
                    }}
                    className="btn btn-secondary btn-xs"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Code2 size={13} />{' '}
                    {showRawExtractedJson ? 'Hide Raw JSON' : 'Inspect Raw JSON Output'}
                  </button>
                  {showRawExtractedJson && (
                    <pre
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {JSON.stringify(extractedResume, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Review Step Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConvertStep('input');
                    }}
                    disabled={savingAsNew}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    ⟵ Re-edit Input
                  </button>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveExtractedAsNew();
                      }}
                      disabled={savingAsNew}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      {savingAsNew ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      Save as New Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyExtracted}
                      disabled={savingAsNew}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Sparkles size={14} /> Apply to Active Profile
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Input & Drag-and-Drop Step */
              <div>
                {/* Drag-and-Drop Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: isDragging
                      ? '2px dashed var(--accent-primary)'
                      : '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    background: isDragging
                      ? 'rgba(99, 102, 241, 0.08)'
                      : 'var(--bg-secondary, rgba(255, 255, 255, 0.02))',
                    marginBottom: '1rem',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(99, 102, 241, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-primary)',
                          flexShrink: 0,
                        }}
                      >
                        {isExtractingPdf ? (
                          <RefreshCw size={19} className="animate-spin" />
                        ) : (
                          <UploadCloud size={19} />
                        )}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {getDropzoneTitle()}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {getDropzoneSubtitle()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {loadedFile && (
                        <button
                          type="button"
                          onClick={() => {
                            readSequenceIdRef.current += 1;
                            setLoadedFile(null);
                            setRawResumeText('');
                          }}
                          className="btn btn-secondary btn-xs"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          title="Clear loaded file"
                        >
                          Clear
                        </button>
                      )}
                      <label
                        className="btn btn-secondary btn-sm"
                        style={{
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.65rem',
                          margin: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <FileText size={13} /> Browse File
                        <input
                          type="file"
                          accept=".pdf,.txt,.md,.json,application/pdf,text/plain,text/markdown,application/json"
                          onChange={handleRawFileUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Textarea Input */}
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
                    {rawResumeText && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {rawResumeText.trim().split(/\s+/).length} words • {rawResumeText.length}{' '}
                        characters
                      </span>
                    )}
                  </div>
                  <textarea
                    value={rawResumeText}
                    onChange={(e) => {
                      readSequenceIdRef.current += 1;
                      setRawResumeText(e.target.value);
                      if (loadedFile) setLoadedFile(null);
                    }}
                    placeholder="Paste your resume contents here (e.g. contact info, work history, skills, education)..."
                    className="input-text"
                    rows={11}
                    disabled={isExtractingPdf}
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.82rem',
                      lineHeight: 1.45,
                      resize: 'vertical',
                      width: '100%',
                    }}
                  />
                </div>

                {/* Action Buttons */}
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
                    onClick={() => {
                      void handleConvertRawResume();
                    }}
                    disabled={!rawResumeText.trim()}
                    className="btn btn-primary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      minWidth: '160px',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={14} /> Parse & Convert to JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Save Action Pill for Long Form Scrolling */}
      {Boolean(initialJsonText && jsonText !== initialJsonText) && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '2rem',
            zIndex: 100,
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-primary)',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-full, 9999px)',
            boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.4))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Unsaved Resume Changes
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              handleJsonChange(initialJsonText);
            }}
          >
            Revert
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              void handleSave(false);
            }}
            disabled={saving || validationErrors.length > 0}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};
