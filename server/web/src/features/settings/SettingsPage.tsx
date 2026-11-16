import React, { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../../lib/auth';
import {
  api,
  SystemSettings,
  SettingMeta,
  DiagnosticsInfo,
  ExtensionConfig,
  ExportFormat,
  PromptTemplateDefaults,
} from '../../api/client';
import { useTheme, ACCENT_THEMES, ColorMode, AccentTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { ScraperSettingsTab } from './ScraperSettingsTab';
import { ResumeManager } from '../resume/ResumeManager';
import { THEME_CATALOG, findThemeMetadata } from '../resume/themeCatalog';
import { ExtensionSyncView } from '../sync/ExtensionSyncView';
import { RegistrationControls } from '../auth/RegistrationControls';
import { extractKeywordsFromResume } from '../../lib/resumeKeywords';
import {
  Laptop,
  Moon,
  Sun,
  Palette,
  Bot,
  FileText,
  Activity,
  Key,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Send,
  Lock,
  Unlock,
  Compass,
  Zap,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  Cpu,
  Save,
  Download,
  FileJson,
  FileSpreadsheet,
  Archive,
} from 'lucide-react';
import {
  LLM_PROVIDERS,
  detectProviderFromModel,
  ALL_RECOMMENDED_MODELS,
  providerDefaultBase,
  resolveEffectiveEndpoint,
  type EffectiveEndpoint,
} from './llmCatalog';

interface SettingsPageProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

type SettingsTab =
  | 'profile'
  | 'general'
  | 'gateway'
  | 'scorer'
  | 'tailor'
  | 'copilot'
  | 'observability'
  | 'scrapers'
  | 'sync'
  | 'system';

const VALID_TABS: SettingsTab[] = [
  'profile',
  'general',
  'gateway',
  'scorer',
  'tailor',
  'copilot',
  'observability',
  'scrapers',
  'sync',
  'system',
];

function getInitialTab(): SettingsTab {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as SettingsTab;
      if (tab && VALID_TABS.includes(tab)) return tab;
      const hash = window.location.hash.replace('#', '') as SettingsTab;
      if (hash && VALID_TABS.includes(hash)) return hash;
    } catch {}
  }
  return 'gateway';
}

/**
 * Shows the endpoint a connection test will actually hit, so an inherited or
 * provider-default route can never be mistaken for a custom override.
 */
const LlmTestTarget: React.FC<{ id: string; target: EffectiveEndpoint }> = ({ id, target }) => (
  <div
    data-testid={`test-llm-target-${id}`}
    style={{
      marginTop: '0.35rem',
      fontSize: '0.76rem',
      color: 'var(--text-muted)',
      display: 'flex',
      alignItems: 'baseline',
      gap: '0.35rem',
      flexWrap: 'wrap',
    }}
  >
    <span style={{ fontWeight: 600 }}>Testing against:</span>
    <code
      style={{
        fontSize: '0.74rem',
        padding: '0.05rem 0.35rem',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {target.url || 'model-prefix routing (no base URL)'}
    </code>
    <span style={{ opacity: 0.85 }}>— {target.note}</span>
  </div>
);

interface ModelSelectionRowProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  datalistId: string;
  tipText: string;
  fallbackModels: { id: string; name: string; description?: string }[];
  isFetching: boolean;
  fetchedModels: { id: string; name: string }[];
  onFetch: () => void;
  helpText?: string;
  providerName?: string;
}

const ModelSelectionRow: React.FC<ModelSelectionRowProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  datalistId,
  tipText,
  fallbackModels,
  isFetching,
  fetchedModels,
  onFetch,
  helpText,
  providerName,
}) => {
  const models = fetchedModels.length > 0 ? fetchedModels : fallbackModels;

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div
        className="model-tip-banner"
        style={{
          padding: '0.6rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Sparkles size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span>{tipText}</span>
      </div>

      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: '0.85rem',
          fontWeight: 500,
          marginBottom: '0.35rem',
        }}
      >
        {label}
      </label>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          id={id}
          type="text"
          list={datalistId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-text"
          style={{ flex: 1 }}
          placeholder={placeholder}
          required
        />

        {models.length > 0 && (
          <select
            aria-label={`Select model for ${label}`}
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value);
              }
            }}
            className="input-select"
            style={{
              maxWidth: '190px',
              fontSize: '0.8rem',
              padding: '0.45rem 0.5rem',
            }}
          >
            <option value="">
              {fetchedModels.length > 0
                ? `Pick (${fetchedModels.length} fetched)...`
                : 'Pick model...'}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={onFetch}
          disabled={isFetching}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            whiteSpace: 'nowrap',
            padding: '0.45rem 0.75rem',
          }}
          title={
            providerName
              ? `Fetch live models from ${providerName}`
              : 'Fetch live models from endpoint'
          }
        >
          <RefreshCw size={12} className={isFetching ? 'spin' : ''} />
          <span>{isFetching ? 'Fetching...' : 'Fetch Models'}</span>
        </button>
      </div>

      <datalist id={datalistId}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.id}
          </option>
        ))}
      </datalist>

      {helpText && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
            display: 'block',
          }}
        >
          {helpText}
        </span>
      )}
    </div>
  );
};

interface InheritedCustomModelSectionProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  preferredTier?: 'fast' | 'reasoning';
  selectedDefaultProvider?: string;
  datalistId: string;
  featureName: string;
  icon?: 'zap' | 'sparkles';
  onFetchModels?: () => void;
  isFetching?: boolean;
  fetchedModels?: { id: string; name: string }[];
}

const InheritedCustomModelSection: React.FC<InheritedCustomModelSectionProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  preferredTier,
  selectedDefaultProvider,
  datalistId,
  featureName,
  onFetchModels,
  isFetching = false,
  fetchedModels = [],
}) => {
  const providerMeta =
    LLM_PROVIDERS.find((p) => p.id === selectedDefaultProvider) || LLM_PROVIDERS[0];
  const matchingTierModels = preferredTier
    ? providerMeta.recommendedModels.filter((m) => m.tier === preferredTier)
    : providerMeta.recommendedModels;
  const fallbackModels =
    matchingTierModels.length > 0 ? matchingTierModels : providerMeta.recommendedModels;
  const models = fetchedModels.length > 0 ? fetchedModels : fallbackModels;

  const tipText =
    preferredTier === 'fast'
      ? `Tip: For ${featureName}, choose high-throughput, fast models (e.g. Flash, Mini, Haiku) for low latency screening.`
      : `Tip: For ${featureName}, choose reasoning and thinking models for deep nuance and ATS compliance.`;

  return (
    <>
      <div
        className="model-tip-banner"
        style={{
          padding: '0.6rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Sparkles size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span>{tipText}</span>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '0.35rem',
          }}
        >
          {label}
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            id={id}
            type="text"
            list={datalistId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-text"
            style={{ flex: 1 }}
            placeholder={placeholder}
            required
          />

          {models.length > 0 && (
            <select
              aria-label={`Select model for ${label}`}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onChange(e.target.value);
                }
              }}
              className="input-select"
              style={{
                maxWidth: '190px',
                fontSize: '0.8rem',
                padding: '0.45rem 0.5rem',
              }}
            >
              <option value="">
                {fetchedModels.length > 0
                  ? `Pick (${fetchedModels.length} fetched)...`
                  : 'Pick model...'}
              </option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          )}

          {onFetchModels && (
            <button
              type="button"
              onClick={onFetchModels}
              disabled={isFetching}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                padding: '0.45rem 0.75rem',
              }}
              title={`Fetch live models from ${providerMeta.name}`}
            >
              <RefreshCw size={12} className={isFetching ? 'spin' : ''} />
              <span>{isFetching ? 'Fetching...' : 'Fetch Models'}</span>
            </button>
          )}
        </div>

        <datalist id={datalistId}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
        </datalist>

        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
            display: 'block',
          }}
        >
          Enter any model available through your {providerMeta.name || 'Default Gateway'} account.
        </span>
      </div>
    </>
  );
};

interface InheritProviderSettingsBlockProps {
  inheritDefault: boolean;
  onToggleInheritDefault: (val: boolean) => void;
  inheritModel: boolean;
  onToggleInheritModel: (val: boolean) => void;
  featureName: string;
  defaultProviderName: string;
  defaultModel?: string;
  children?: React.ReactNode;
}

const InheritProviderSettingsBlock: React.FC<InheritProviderSettingsBlockProps> = ({
  inheritDefault,
  onToggleInheritDefault,
  inheritModel,
  onToggleInheritModel,
  featureName,
  defaultProviderName,
  defaultModel,
  children,
}) => {
  return (
    <>
      <div
        style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: inheritDefault ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={inheritDefault}
            onChange={(e) => onToggleInheritDefault(e.target.checked)}
            style={{
              accentColor: 'var(--accent-primary)',
              width: '16px',
              height: '16px',
            }}
          />
          Inherit provider credentials from Default AI Gateway (Recommended)
        </label>
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            marginTop: '0.35rem',
            marginLeft: '1.65rem',
          }}
        >
          {inheritDefault
            ? `Uses ${defaultProviderName} API key and base URL.`
            : `Configure a dedicated, independent LLM model and credentials specifically for ${featureName}.`}
        </div>

        {inheritDefault && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-subtle)',
              marginLeft: '1.65rem',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.825rem',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={inheritModel}
                onChange={(e) => onToggleInheritModel(e.target.checked)}
                style={{
                  accentColor: 'var(--accent-primary)',
                  width: '15px',
                  height: '15px',
                }}
              />
              Also inherit model from Default AI Gateway ({defaultModel || 'Default Model'})
            </label>
          </div>
        )}
      </div>

      {inheritDefault && !inheritModel && (
        <div
          style={{
            marginTop: '0.75rem',
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.35rem',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                <Lock size={12} />
                Provider: {defaultProviderName} (Inherited)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                API credentials and base URL are automatically inherited.
              </span>
            </div>
          </div>
          {children}
        </div>
      )}
    </>
  );
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSaveSettings }) => {
  const { colorMode, setColorMode, accentTheme, setAccentTheme } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>(getInitialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo | null>(null);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  };

  // Extension settings state
  const [extensionConfig, setExtensionConfig] = useState<ExtensionConfig>({
    scanIntervalHours: 6,
    passiveMode: true,
    activeMode: false,
    activeModeDelayMs: 2000,
    maxPostingAgeDays: 30,
    titleFilter: {
      positive: [],
      negative: ['word:intern', 'junior', '.net', 'php', 'wordpress', 'embedded', 'firmware'],
    },
    locationFilter: {
      allow: ['remote', 'worldwide', 'anywhere'],
      block: [],
    },
    portals: {},
    trackedCompanies: [],
    searchBoards: {},
    searchMaxResultsPerTerm: 25,
    adzunaAppId: null,
    adzunaAppKey: null,
    adzunaCountry: 'us',
  });
  const [_extensionLoaded, setExtensionLoaded] = useState(false);
  const [_isExtensionDirty, setIsExtensionDirty] = useState(false);
  const [savingScrapers, setSavingScrapers] = useState(false);
  const [extractingResume, setExtractingResume] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);
  const [tailoredJobs, setTailoredJobs] = useState<Array<{ id: string; label: string }>>([]);
  const [tailoredJobsLoaded, setTailoredJobsLoaded] = useState(false);
  const [loadingTailoredJobs, setLoadingTailoredJobs] = useState(false);
  const [tailoredJobsError, setTailoredJobsError] = useState<string | null>(null);
  const [tailoredJobsReloadKey, setTailoredJobsReloadKey] = useState(0);
  const [selectedTailoredJobId, setSelectedTailoredJobId] = useState('');

  // System settings state
  const [formSettings, setFormSettings] = useState<SystemSettings>({
    default_llm_model: 'openrouter/openrouter/free',
    default_llm_provider: 'openrouter',
    default_llm_api_key: '',
    default_llm_api_base: '',
    scorer_inherit_default: true,
    scorer_inherit_model: true,
    tailor_inherit_default: true,
    tailor_inherit_model: true,
    copilot_inherit_default: true,
    copilot_inherit_model: true,
    scorer_model: 'openrouter/openrouter/free',
    scorer_provider: 'openrouter',
    scorer_api_key: '',
    scorer_api_base: '',
    scorer_threshold: settings.threshold || 75,
    worker_enabled: true,
    worker_poll_interval_seconds: 10,
    tailor_model: 'openrouter/openrouter/free',
    tailor_provider: 'openrouter',
    tailor_api_key: '',
    tailor_api_base: '',
    tailor_theme: 'jsonresume-theme-folio',
    tailor_style: 'executive',
    tailor_pipeline_mode: 'sequential',
    tailor_instructions: '',
    tailor_enable_final_check: false,
    tailor_final_check_model: '',
    tailor_prompt_strategy_and_basics: '',
    tailor_prompt_work: '',
    tailor_prompt_projects: '',
    tailor_prompt_qualifications: '',
    tailor_prompt_monolithic: '',
    tailor_prompt_final_check: '',
    tailor_timeout_seconds: 900,
    copilot_model: 'openrouter/openrouter/free',
    copilot_provider: 'openrouter',
    copilot_api_key: '',
    copilot_api_base: '',
    copilot_stop_slop_enabled: true,
    copilot_constraints: '',
    copilot_system_prompt_template: '',
    copilot_outreach_prompt_template: '',
    copilot_qa_prompt_template: '',
    copilot_cover_letter_prompt_template: '',
    observability_provider: 'opik',
    opik_enabled: false,
    opik_project_name: 'jobfoundry',
    opik_api_key: '',
    opik_workspace: '',
    opik_url_override: '',
    langfuse_enabled: false,
    langfuse_public_key: '',
    langfuse_secret_key: '',
    langfuse_host: 'https://cloud.langfuse.com',
    langsmith_enabled: false,
    langsmith_api_key: '',
    langsmith_project: 'jobfoundry',
    langsmith_endpoint: 'https://api.smith.langchain.com',
    theme_color_mode: colorMode,
    theme_accent: accentTheme,
  });

  const [meta, setMeta] = useState<Record<string, SettingMeta>>({});
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [tempColorMode, setTempColorMode] = useState<ColorMode>(colorMode);
  const [tempAccentTheme, setTempAccentTheme] = useState<AccentTheme>(accentTheme);

  // Secret editing toggles
  const [editingDefaultKey, setEditingDefaultKey] = useState(false);
  const [newDefaultKey, setNewDefaultKey] = useState('');
  const [editingScorerKey, setEditingScorerKey] = useState(false);
  const [newScorerKey, setNewScorerKey] = useState('');
  const [editingTailorKey, setEditingTailorKey] = useState(false);
  const [newTailorKey, setNewTailorKey] = useState('');
  const [editingOpikKey, setEditingOpikKey] = useState(false);
  const [newOpikKey, setNewOpikKey] = useState('');
  const [editingLangfusePubKey, setEditingLangfusePubKey] = useState(false);
  const [newLangfusePubKey, setNewLangfusePubKey] = useState('');
  const [editingLangfuseSecKey, setEditingLangfuseSecKey] = useState(false);
  const [newLangfuseSecKey, setNewLangfuseSecKey] = useState('');
  const [editingLangsmithKey, setEditingLangsmithKey] = useState(false);
  const [newLangsmithKey, setNewLangsmithKey] = useState('');
  const [activeObservabilityProvider, setActiveObservabilityProvider] = useState<
    'opik' | 'langfuse' | 'langsmith'
  >('opik');

  // Default Gateway State
  const [selectedDefaultProvider, setSelectedDefaultProvider] = useState<string>(() => {
    return (
      formSettings.default_llm_provider ||
      detectProviderFromModel(formSettings.default_llm_model || '') ||
      'openrouter'
    );
  });
  const [testingDefaultLlm, setTestingDefaultLlm] = useState(false);
  const [defaultTestResult, setDefaultTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
    apiBase?: string;
  } | null>(null);

  // Advanced AI Overrides Accordion State under Gateway
  const [showAdvancedAiOverrides, setShowAdvancedAiOverrides] = useState<boolean>(false);

  // LLM Provider & Multi-Model Selection State
  const [selectedScorerProvider, setSelectedScorerProvider] = useState<string>(() => {
    return (
      formSettings.scorer_provider ||
      detectProviderFromModel(formSettings.scorer_model) ||
      'openrouter'
    );
  });

  const [selectedTailorProvider, setSelectedTailorProvider] = useState<string>(() => {
    return (
      formSettings.tailor_provider ||
      detectProviderFromModel(formSettings.tailor_model) ||
      'openrouter'
    );
  });
  const [showTailorPromptTemplates, setShowTailorPromptTemplates] = useState<boolean>(false);

  // Copilot Settings State
  const [editingCopilotKey, setEditingCopilotKey] = useState(false);
  const [newCopilotKey, setNewCopilotKey] = useState('');
  const [selectedCopilotProvider, setSelectedCopilotProvider] = useState<string>('openrouter');
  const [testingCopilotLlm, setTestingCopilotLlm] = useState(false);
  const [copilotTestResult, setCopilotTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
    apiBase?: string;
  } | null>(null);
  const [defaultPromptTemplates, setDefaultPromptTemplates] = useState<
    Partial<PromptTemplateDefaults>
  >({});

  // LLM Test Connection State
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
    apiBase?: string;
  } | null>(null);

  const [testingTailorLlm, setTestingTailorLlm] = useState(false);
  const [tailorTestResult, setTailorTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
    apiBase?: string;
  } | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [fetchingModelsFeature, setFetchingModelsFeature] = useState<string | null>(null);
  const [fetchedModelsMap, setFetchedModelsMap] = useState<
    Record<string, { id: string; name: string }[]>
  >({});
  const [hasActiveResume, setHasActiveResume] = useState(false);
  const [isExtensionPaired, setIsExtensionPaired] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('jf_extension_paired') === 'true';
  });

  // Fetch backend settings & telemetry once on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [settingsRes, diagRes, extRes, defaultsRes, resumeRes] = await Promise.allSettled([
          api.getSettings(),
          api.getDiagnostics(),
          api.getExtensionConfig(),
          api.getPromptTemplateDefaults(),
          api.getActiveResume(),
        ]);

        if (resumeRes.status === 'fulfilled' && resumeRes.value) {
          setHasActiveResume(true);
        }

        if (settingsRes.status === 'fulfilled') {
          const { settings: backendSettings, meta: backendMeta } = settingsRes.value;
          setFormSettings((prev) => ({
            ...prev,
            ...backendSettings,
          }));
          setMeta(backendMeta);

          if (backendSettings.default_llm_provider) {
            setSelectedDefaultProvider(backendSettings.default_llm_provider);
          } else if (backendSettings.default_llm_model) {
            setSelectedDefaultProvider(detectProviderFromModel(backendSettings.default_llm_model));
          } else if (backendSettings.scorer_provider) {
            setSelectedDefaultProvider(backendSettings.scorer_provider);
          }

          if (backendSettings.scorer_provider) {
            setSelectedScorerProvider(backendSettings.scorer_provider);
          } else if (backendSettings.scorer_model) {
            setSelectedScorerProvider(detectProviderFromModel(backendSettings.scorer_model));
          }
          if (backendSettings.tailor_provider) {
            setSelectedTailorProvider(backendSettings.tailor_provider);
          } else if (backendSettings.tailor_model) {
            setSelectedTailorProvider(detectProviderFromModel(backendSettings.tailor_model));
          }
          if (backendSettings.copilot_provider) {
            setSelectedCopilotProvider(backendSettings.copilot_provider);
          } else if (backendSettings.copilot_model) {
            setSelectedCopilotProvider(detectProviderFromModel(backendSettings.copilot_model));
          }
          if (backendSettings.observability_provider) {
            setActiveObservabilityProvider(
              backendSettings.observability_provider as 'opik' | 'langfuse' | 'langsmith'
            );
          } else if (backendSettings.langfuse_enabled) {
            setActiveObservabilityProvider('langfuse');
          } else if (backendSettings.langsmith_enabled) {
            setActiveObservabilityProvider('langsmith');
          }

          const hasLlmKey = Boolean(
            backendSettings.default_llm_api_key ||
            backendSettings.scorer_api_key ||
            backendMeta?.default_llm_api_key?.hasCustomKey ||
            backendMeta?.scorer_api_key?.hasCustomKey
          );

          if (!hasLlmKey && (activeTab === 'scorer' || !window.location.search)) {
            setActiveTab('gateway');
            if (typeof window !== 'undefined' && window.history?.replaceState) {
              window.history.replaceState(null, '', '/settings?tab=gateway');
            }
          }
        }

        if (defaultsRes.status === 'fulfilled' && defaultsRes.value?.defaults) {
          setDefaultPromptTemplates(defaultsRes.value.defaults);
        }

        if (diagRes.status === 'fulfilled') {
          setDiagnostics(diagRes.value);
        }

        if (extRes.status === 'fulfilled') {
          setExtensionConfig(extRes.value);
          setExtensionLoaded(true);
        }
      } catch (err: any) {
        toast.error(`Failed to load system settings: ${err?.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tailored resume variants only when the System tab needs them.
  // The list is only marked loaded after a successful response so failures can retry.
  useEffect(() => {
    if (activeTab !== 'system' || tailoredJobsLoaded) return;

    let cancelled = false;
    setLoadingTailoredJobs(true);
    setTailoredJobsError(null);
    api
      .getTailoredJobs()
      .then((jobs) => {
        if (cancelled) return;
        const options = jobs.map((job) => ({
          id: job.id,
          label: `${job.title} — ${job.company}`,
        }));
        setTailoredJobs(options);
        setSelectedTailoredJobId((current) => current || options[0]?.id || '');
        setTailoredJobsLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        // Exporting the master profile remains available when the job list cannot load.
        setTailoredJobsError(err instanceof Error ? err.message : 'Failed to load tailored jobs');
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingTailoredJobs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, tailoredJobsLoaded, tailoredJobsReloadKey]);

  const handleSelectDefaultProvider = (providerId: string) => {
    setSelectedDefaultProvider(providerId);
    handleFieldChange('default_llm_provider', providerId);
    const providerMeta = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (providerMeta?.isLocal || providerMeta?.isCustom) {
      if (!formSettings.default_llm_api_base && providerMeta.defaultBase) {
        handleFieldChange('default_llm_api_base', providerMeta.defaultBase);
      }
    } else {
      if (
        formSettings.default_llm_api_base?.includes('11434') ||
        formSettings.default_llm_api_base?.includes('localhost:8000')
      ) {
        handleFieldChange('default_llm_api_base', '');
      }
    }
    const fast = providerMeta?.recommendedModels.find((m) => m.tier === 'fast');
    if (fast) {
      handleFieldChange('default_llm_model', fast.id);
    }
  };

  const handleSelectScorerProvider = (providerId: string) => {
    setSelectedScorerProvider(providerId);
    handleFieldChange('scorer_provider', providerId);
    const providerMeta = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (providerMeta?.isLocal || providerMeta?.isCustom) {
      if (!formSettings.scorer_api_base && providerMeta.defaultBase) {
        handleFieldChange('scorer_api_base', providerMeta.defaultBase);
      }
    } else {
      if (
        formSettings.scorer_api_base?.includes('11434') ||
        formSettings.scorer_api_base?.includes('localhost:8000')
      ) {
        handleFieldChange('scorer_api_base', '');
      }
    }
  };

  const handleSelectTailorProvider = (providerId: string) => {
    setSelectedTailorProvider(providerId);
    handleFieldChange('tailor_provider', providerId);
    const providerMeta = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (providerMeta?.isLocal || providerMeta?.isCustom) {
      if (!formSettings.tailor_api_base && providerMeta.defaultBase) {
        handleFieldChange('tailor_api_base', providerMeta.defaultBase);
      }
    } else {
      if (
        formSettings.tailor_api_base?.includes('11434') ||
        formSettings.tailor_api_base?.includes('localhost:8000')
      ) {
        handleFieldChange('tailor_api_base', '');
      }
    }
  };

  const handleSelectCopilotProvider = (providerId: string) => {
    setSelectedCopilotProvider(providerId);
    handleFieldChange('copilot_provider', providerId);
    const providerMeta = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (providerMeta?.isLocal || providerMeta?.isCustom) {
      if (!formSettings.copilot_api_base && providerMeta.defaultBase) {
        handleFieldChange('copilot_api_base', providerMeta.defaultBase);
      }
    } else {
      if (
        formSettings.copilot_api_base?.includes('11434') ||
        formSettings.copilot_api_base?.includes('localhost:8000')
      ) {
        handleFieldChange('copilot_api_base', '');
      }
    }
  };

  const handleFieldChange = (key: keyof SystemSettings, val: any) => {
    setFormSettings((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleExtensionChange = (updated: ExtensionConfig) => {
    setExtensionConfig(updated);
    setIsExtensionDirty(true);
    setIsDirty(true);
  };

  const handleSaveExtensionConfig = async () => {
    setSavingScrapers(true);
    try {
      const res = await api.updateExtensionConfig(extensionConfig);
      if (res.config) {
        setExtensionConfig(res.config);
      }
      setIsExtensionDirty(false);
      toast.success('Scrapers and search filters saved successfully');
    } catch (err: any) {
      toast.error(`Failed to save scrapers config: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingScrapers(false);
    }
  };

  const handleExtractFromResume = async () => {
    setExtractingResume(true);
    try {
      const activeResume = await api.getActiveResume();
      if (!activeResume?.resume) {
        toast.error('No active master resume found. Please upload or activate a resume first.');
        return;
      }
      const titles = extractKeywordsFromResume(activeResume.resume);
      if (titles.length === 0) {
        toast.info('No role keywords detected in active resume.');
        return;
      }
      const existing = extensionConfig.titleFilter?.positive || [];
      const combined = Array.from(new Set([...existing, ...titles]));
      setExtensionConfig((prev) => ({
        ...prev,
        titleFilter: {
          ...prev.titleFilter,
          positive: combined,
        },
      }));
      setIsExtensionDirty(true);
      setIsDirty(true);
      toast.success(`Fetched ${titles.length} role keyword(s) from master resume`);
    } catch (err: any) {
      toast.error(`Failed to fetch resume keywords: ${err?.message || 'Unknown error'}`);
    } finally {
      setExtractingResume(false);
    }
  };

  const handleExport = async (format: ExportFormat, jobId?: string) => {
    setExportingFormat(format);
    setExportingJobId(jobId || null);
    try {
      const { blob, filename } = jobId
        ? await api.downloadExport(format, { jobId })
        : await api.downloadExport(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      toast.success(`Export ready: ${filename}`);
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setExportingFormat(null);
      setExportingJobId(null);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<SystemSettings> = {
        ...formSettings,
        scorer_provider: selectedScorerProvider,
        tailor_provider: selectedTailorProvider,
        copilot_provider: selectedCopilotProvider,
        scorer_threshold: Number(formSettings.scorer_threshold) || 75,
        tailor_timeout_seconds: Number(formSettings.tailor_timeout_seconds) || 900,
        worker_poll_interval_seconds: Number(formSettings.worker_poll_interval_seconds) || 10,
        theme_color_mode: tempColorMode,
        theme_accent: tempAccentTheme,
      };

      if (editingDefaultKey && newDefaultKey.trim()) {
        payload.default_llm_api_key = newDefaultKey.trim();
      }
      payload.default_llm_provider = selectedDefaultProvider;

      if (editingScorerKey && newScorerKey.trim()) {
        payload.scorer_api_key = newScorerKey.trim();
      }
      if (editingTailorKey && newTailorKey.trim()) {
        payload.tailor_api_key = newTailorKey.trim();
      }
      if (editingCopilotKey && newCopilotKey.trim()) {
        payload.copilot_api_key = newCopilotKey.trim();
      }
      if (editingOpikKey && newOpikKey.trim()) {
        payload.opik_api_key = newOpikKey.trim();
      }
      if (editingLangfusePubKey && newLangfusePubKey.trim()) {
        payload.langfuse_public_key = newLangfusePubKey.trim();
      }
      if (editingLangfuseSecKey && newLangfuseSecKey.trim()) {
        payload.langfuse_secret_key = newLangfuseSecKey.trim();
      }
      if (editingLangsmithKey && newLangsmithKey.trim()) {
        payload.langsmith_api_key = newLangsmithKey.trim();
      }
      payload.observability_provider = activeObservabilityProvider;

      const res = await api.updateSettings(payload);
      if (res.settings) {
        setFormSettings((prev) => ({
          ...prev,
          ...res.settings,
        }));
        setMeta(res.meta);
        setEditingDefaultKey(false);
        setNewDefaultKey('');
        setEditingScorerKey(false);
        setNewScorerKey('');
        setEditingTailorKey(false);
        setNewTailorKey('');
        setEditingCopilotKey(false);
        setNewCopilotKey('');
        setEditingOpikKey(false);
        setNewOpikKey('');
        setEditingLangfusePubKey(false);
        setNewLangfusePubKey('');
        setEditingLangfuseSecKey(false);
        setNewLangfuseSecKey('');
        setEditingLangsmithKey(false);
        setNewLangsmithKey('');
      }

      // Also persist extension/scraper config if it was modified
      if (_isExtensionDirty && _extensionLoaded) {
        const extRes = await api.updateExtensionConfig(extensionConfig);
        if (extRes?.config) setExtensionConfig(extRes.config);
        setIsExtensionDirty(false);
      }

      if (tempColorMode !== colorMode) {
        setColorMode(tempColorMode);
      }
      if (tempAccentTheme !== accentTheme) {
        setAccentTheme(tempAccentTheme);
      }

      onSaveSettings({
        apiKey: settings.apiKey,
        apiUrl: apiUrl.trim(),
        threshold: Number(formSettings.scorer_threshold) || 75,
      });

      setIsDirty(false);
      toast.success('Settings updated and persisted successfully');
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!confirm('Reset all runtime settings to default values?')) return;
    setFormSettings((prev) => ({
      ...prev,
      default_llm_model: 'openrouter/openrouter/free',
      default_llm_provider: 'openrouter',
      scorer_inherit_default: true,
      scorer_inherit_model: true,
      tailor_inherit_default: true,
      tailor_inherit_model: true,
      copilot_inherit_default: true,
      copilot_inherit_model: true,
      scorer_model: 'openrouter/openrouter/free',
      scorer_threshold: 75,
      tailor_model: 'openrouter/openrouter/free',
      tailor_theme: 'jsonresume-theme-folio',
      tailor_timeout_seconds: 900,
      observability_provider: 'opik',
      opik_enabled: false,
      langfuse_enabled: false,
      langsmith_enabled: false,
    }));
    setActiveObservabilityProvider('opik');
    setApiUrl(DEFAULT_SETTINGS.apiUrl);
    setTempColorMode('system');
    setTempAccentTheme('indigo');
    setIsDirty(true);
    toast.info('Settings form reset. Click "Save Changes" to apply.');
  };

  const handleTestLlm = async (
    service: 'gateway' | 'scorer' | 'tailor' | 'copilot' = 'gateway'
  ) => {
    if (service === 'gateway') {
      setTestingDefaultLlm(true);
      setDefaultTestResult(null);
      try {
        const model = formSettings.default_llm_model || 'openrouter/openrouter/free';
        const apiBase = gatewayTestTarget.url;
        const apiKey = editingDefaultKey ? newDefaultKey : formSettings.default_llm_api_key;
        const provider = selectedDefaultProvider;
        const res = await api.testLlmConnection({
          model,
          apiBase,
          apiKey,
          provider,
          feature: 'gateway',
        });
        setDefaultTestResult(res);
        if (res.success) {
          toast.success(res.message || 'Default Gateway connection successful');
        } else {
          toast.error(res.error || 'Default Gateway connection failed');
        }
      } catch (err: any) {
        const msg = err?.message || 'Connection test failed';
        setDefaultTestResult({
          success: false,
          error: msg,
          apiBase: err?.details?.apiBase || gatewayTestTarget.url,
        });
        toast.error(msg);
      } finally {
        setTestingDefaultLlm(false);
      }
    } else if (service === 'scorer') {
      setTestingLlm(true);
      setTestResult(null);
      try {
        const isInherited = formSettings.scorer_inherit_default !== false;
        const inheritModel = formSettings.scorer_inherit_model !== false;
        const model = isInherited
          ? (inheritModel
              ? formSettings.default_llm_model
              : formSettings.scorer_model || formSettings.default_llm_model) ||
            'openrouter/openrouter/free'
          : formSettings.scorer_model;
        const apiBase = scorerTestTarget.url;
        const apiKey = isInherited
          ? editingDefaultKey
            ? newDefaultKey
            : formSettings.default_llm_api_key
          : editingScorerKey
            ? newScorerKey
            : formSettings.scorer_api_key;
        const provider = isInherited ? selectedDefaultProvider : selectedScorerProvider;
        const res = await api.testLlmConnection({
          model,
          apiBase,
          apiKey,
          provider,
          feature: 'scorer',
        });
        setTestResult(res);
        if (res.success) {
          toast.success(res.message || 'LLM connection successful');
        } else {
          toast.error(res.error || 'LLM connection failed');
        }
      } catch (err: any) {
        const msg = err?.message || 'Connection test failed';
        setTestResult({
          success: false,
          error: msg,
          apiBase: err?.details?.apiBase || scorerTestTarget.url,
        });
        toast.error(msg);
      } finally {
        setTestingLlm(false);
      }
    } else if (service === 'tailor') {
      setTestingTailorLlm(true);
      setTailorTestResult(null);
      try {
        const isInherited = formSettings.tailor_inherit_default !== false;
        const inheritModel = formSettings.tailor_inherit_model !== false;
        const model = isInherited
          ? (inheritModel
              ? formSettings.default_llm_model
              : formSettings.tailor_model || formSettings.default_llm_model) ||
            'openrouter/openrouter/free'
          : formSettings.tailor_model;
        const apiBase = tailorTestTarget.url;
        const apiKey = isInherited
          ? editingDefaultKey
            ? newDefaultKey
            : formSettings.default_llm_api_key
          : editingTailorKey
            ? newTailorKey
            : formSettings.tailor_api_key;
        const provider = isInherited ? selectedDefaultProvider : selectedTailorProvider;
        const res = await api.testLlmConnection({
          model,
          apiBase,
          apiKey,
          provider,
          feature: 'tailor',
        });
        setTailorTestResult(res);
        if (res.success) {
          toast.success(res.message || 'Tailoring model connection successful');
        } else {
          toast.error(res.error || 'Tailoring model connection failed');
        }
      } catch (err: any) {
        const msg = err?.message || 'Connection test failed';
        setTailorTestResult({
          success: false,
          error: msg,
          apiBase: err?.details?.apiBase || tailorTestTarget.url,
        });
        toast.error(msg);
      } finally {
        setTestingTailorLlm(false);
      }
    } else if (service === 'copilot') {
      setTestingCopilotLlm(true);
      setCopilotTestResult(null);
      try {
        const isInherited = formSettings.copilot_inherit_default !== false;
        const inheritModel = formSettings.copilot_inherit_model !== false;
        const model = isInherited
          ? (inheritModel
              ? formSettings.default_llm_model
              : formSettings.copilot_model || formSettings.default_llm_model) ||
            'openrouter/openrouter/free'
          : formSettings.copilot_model;
        const apiBase = copilotTestTarget.url;
        const apiKey = isInherited
          ? editingDefaultKey
            ? newDefaultKey
            : formSettings.default_llm_api_key
          : editingCopilotKey
            ? newCopilotKey
            : formSettings.copilot_api_key;
        const provider = isInherited ? selectedDefaultProvider : selectedCopilotProvider;
        const res = await api.testLlmConnection({
          model,
          apiBase,
          apiKey,
          provider,
          feature: 'copilot',
        });
        setCopilotTestResult(res);
        if (res.success) {
          toast.success(res.message || 'Copilot model connection successful');
        } else {
          toast.error(res.error || 'Copilot model connection failed');
        }
      } catch (err: any) {
        const msg = err?.message || 'Connection test failed';
        setCopilotTestResult({
          success: false,
          error: msg,
          apiBase: err?.details?.apiBase || copilotTestTarget.url,
        });
        toast.error(msg);
      } finally {
        setTestingCopilotLlm(false);
      }
    }
  };

  const handleFetchModels = async (
    feature: 'gateway' | 'scorer' | 'tailor' | 'copilot',
    provider: string,
    apiKey: string,
    apiBase: string,
    model?: string
  ) => {
    setFetchingModelsFeature(feature);
    try {
      const res = await api.fetchModels({
        feature,
        provider,
        apiKey,
        apiBase,
        model,
      });
      if (res.success && res.models && res.models.length > 0) {
        setFetchedModelsMap((prev) => ({
          ...prev,
          [feature]: res.models,
        }));
        toast.success(
          `Fetched ${res.models.length} models from endpoint${res.cached ? ' (cached)' : ''}`
        );
      } else if (res.models && res.models.length === 0) {
        toast.info('No models returned by endpoint.');
      } else {
        toast.error(res.error || 'Failed to fetch models from endpoint');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error connecting to model endpoint');
    } finally {
      setFetchingModelsFeature(null);
    }
  };

  const renderSourceBadge = (key: string) => {
    const itemMeta = meta[key];
    if (!itemMeta) return null;
    if (itemMeta.source === 'user') {
      return (
        <span
          className="badge badge-purple"
          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
          title="This is your personal BYOK override, stored per user"
        >
          Your Override
        </span>
      );
    }
    if (itemMeta.source === 'system') {
      return (
        <span
          className="badge badge-primary"
          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
          title="This setting is customized and stored in SQLite"
        >
          Database Override
        </span>
      );
    }
    if (itemMeta.source === 'env') {
      return (
        <span
          className="badge badge-blue"
          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
          title="Inherited from environment or .env file"
        >
          Inherited (.env)
        </span>
      );
    }
    return (
      <span
        className="badge badge-muted"
        style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
        title="Using system default value"
      >
        Default
      </span>
    );
  };

  const renderProviderSelect = (
    selectedId: string,
    onSelect: (providerId: string) => void,
    label: string,
    id: string
  ) => {
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '0.4rem',
          }}
        >
          {label}
        </label>
        <select
          id={id}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="input-text"
          style={{ maxWidth: '420px', cursor: 'pointer', padding: '0.45rem 0.65rem' }}
          aria-label={label}
        >
          <optgroup label="Hosted Cloud Providers">
            {LLM_PROVIDERS.filter((p) => !p.isLocal && !p.isCustom).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Local & Self-Hosted">
            {LLM_PROVIDERS.filter((p) => p.isLocal || p.isCustom).map((p) => (
              <option key={p.id} value={p.id}>
                {p.isLocal ? `🏠 ${p.name}` : `⚙️ ${p.name}`}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    );
  };

  const renderEndpointBaseUrlSection = (
    providerId: string,
    currentBase: string | undefined,
    onBaseChange: (val: string) => void,
    label = 'Endpoint Base URL',
    sourceBadgeKey?: string,
    id = 'llm-base-url'
  ) => {
    const p = LLM_PROVIDERS.find((x) => x.id === providerId);
    const isCustomOrLocal = Boolean(p?.isCustom || p?.isLocal);
    const fixedBase = providerDefaultBase(providerId);

    if (isCustomOrLocal) {
      return (
        <div style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.35rem',
            }}
          >
            <label htmlFor={id} style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {label} (Custom / Self-Hosted)
            </label>
            {sourceBadgeKey && currentBase?.trim() ? renderSourceBadge(sourceBadgeKey) : null}
          </div>
          <input
            id={id}
            type="text"
            value={currentBase || ''}
            onChange={(e) => onBaseChange(e.target.value)}
            className="input-text"
            placeholder={p?.defaultBase || 'http://localhost:8000/v1'}
          />
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '0.25rem',
              display: 'block',
            }}
          >
            {p?.keyHelp || 'Specify your local endpoint or custom OpenAI-compatible proxy URL.'}
          </span>
        </div>
      );
    }

    const hasExistingOverride = Boolean(
      currentBase && currentBase.trim() && currentBase.trim() !== fixedBase
    );

    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
          }}
        >
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</label>
          {sourceBadgeKey && hasExistingOverride ? renderSourceBadge(sourceBadgeKey) : null}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input, rgba(255,255,255,0.02))',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Lock size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>
            {fixedBase || 'LiteLLM native prefix routing (no custom URL needed)'}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              background: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--accent-primary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {fixedBase ? 'Fixed Built-in' : 'Native Routing'}
          </span>
        </div>
        {hasExistingOverride && (
          <div
            style={{
              marginTop: '0.4rem',
              padding: '0.4rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.76rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <span>
              Stored custom override:{' '}
              <code style={{ color: 'var(--accent-warning, #f59e0b)' }}>{currentBase}</code>
            </span>
            <button
              type="button"
              onClick={() => onBaseChange('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              Clear override
            </button>
          </div>
        )}
        <span
          style={{
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
            display: 'block',
          }}
        >
          Built-in endpoints are locked to prevent credential leaks. To use a custom proxy, switch
          provider to &ldquo;Custom / Self-Hosted Gateway&rdquo;.
        </span>
      </div>
    );
  };

  // Effective test targets, mirrored from the backend resolver so the UI can
  // state exactly which endpoint "Test Connection" will call.
  const gatewayTestTarget = resolveEffectiveEndpoint({
    inherit: true,
    gatewayBase: formSettings.default_llm_api_base,
    gatewayProvider: selectedDefaultProvider,
    gatewayModel: formSettings.default_llm_model,
  });
  const scorerTestTarget = resolveEffectiveEndpoint({
    inherit: formSettings.scorer_inherit_default !== false,
    gatewayBase: formSettings.default_llm_api_base,
    gatewayProvider: selectedDefaultProvider,
    gatewayModel: formSettings.default_llm_model,
    featureBase: formSettings.scorer_api_base,
    featureProvider: selectedScorerProvider,
    featureModel: formSettings.scorer_model,
  });
  const tailorTestTarget = resolveEffectiveEndpoint({
    inherit: formSettings.tailor_inherit_default !== false,
    gatewayBase: formSettings.default_llm_api_base,
    gatewayProvider: selectedDefaultProvider,
    gatewayModel: formSettings.default_llm_model,
    featureBase: formSettings.tailor_api_base,
    featureProvider: selectedTailorProvider,
    featureModel: formSettings.tailor_model,
  });
  const copilotTestTarget = resolveEffectiveEndpoint({
    inherit: formSettings.copilot_inherit_default !== false,
    gatewayBase: formSettings.default_llm_api_base,
    gatewayProvider: selectedDefaultProvider,
    gatewayModel: formSettings.default_llm_model,
    featureBase: formSettings.copilot_api_base,
    featureProvider: selectedCopilotProvider,
    featureModel: formSettings.copilot_model,
  });

  return (
    <div className="settings-container">
      {/* Page Header */}
      <div className="settings-header">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.35rem',
            }}
          >
            <Sliders size={24} style={{ color: 'var(--accent-primary)' }} />
            System & Dashboard Settings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Configure runtime AI scoring, master profile, resume tailoring models, and ingestion
            filters.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isDirty && (
            <span
              className="badge badge-amber animate-pulse"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <AlertTriangle size={12} /> Unsaved Changes
            </span>
          )}
          <button
            type="button"
            onClick={handleResetToDefaults}
            disabled={saving || loading}
            className="btn btn-secondary btn-sm"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={saving || loading}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '110px' }}
          >
            <CheckCircle2 size={15} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Onboarding & Setup Stepper Header */}
      {(() => {
        const isLlmConfigured = Boolean(
          formSettings.default_llm_api_key ||
          meta?.default_llm_api_key?.hasCustomKey ||
          defaultTestResult?.success
        );
        const isResumeConfigured = Boolean(hasActiveResume);
        const isScrapersConfigured = Boolean(
          (extensionConfig.titleFilter?.positive?.length || 0) > 0 ||
          Object.values(extensionConfig.portals || {}).some(Boolean) ||
          Object.values(extensionConfig.searchBoards || {}).some(Boolean)
        );

        const steps: Array<{
          id: SettingsTab;
          number: number;
          label: string;
          sublabel: string;
          complete: boolean;
        }> = [
          {
            id: 'gateway',
            number: 1,
            label: 'AI Engine',
            sublabel: isLlmConfigured ? 'Ready' : 'Choose Model',
            complete: isLlmConfigured,
          },
          {
            id: 'profile',
            number: 2,
            label: 'Master Resume',
            sublabel: isResumeConfigured ? 'Loaded' : 'Upload or AI Convert',
            complete: isResumeConfigured,
          },
          {
            id: 'scrapers',
            number: 3,
            label: 'Search Filters',
            sublabel: isScrapersConfigured ? 'Configured' : 'Titles & Boards',
            complete: isScrapersConfigured,
          },
          {
            id: 'sync',
            number: 4,
            label: 'Extension Sync',
            sublabel: 'Pair & Hunt',
            complete: isExtensionPaired || Boolean(extensionConfig?.updatedAt),
          },
        ];

        return (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Quick Setup Progression</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Complete these 4 steps to start automated hunting and AI qualification
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {steps.map((step, idx) => {
                const isActive = activeTab === step.id;
                return (
                  <React.Fragment key={step.id}>
                    {idx > 0 && (
                      <span
                        style={{
                          color: 'var(--border-subtle)',
                          fontSize: '0.8rem',
                          padding: '0 0.1rem',
                        }}
                      >
                        →
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTabChange(step.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: isActive
                          ? 'var(--accent-primary)'
                          : step.complete
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'var(--bg-input)',
                        color: isActive
                          ? '#ffffff'
                          : step.complete
                            ? 'var(--color-success, #10b981)'
                            : 'var(--text-secondary)',
                        border: `1px solid ${
                          isActive
                            ? 'var(--accent-primary)'
                            : step.complete
                              ? 'rgba(16, 185, 129, 0.25)'
                              : 'var(--border-subtle)'
                        }`,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: isActive
                            ? 'rgba(255, 255, 255, 0.25)'
                            : step.complete
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {step.complete ? '✓' : step.number}
                      </span>
                      <span style={{ fontWeight: 600 }}>{step.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="settings-layout">
        {/* Left Sidebar Navigation */}
        <aside className="settings-sidebar">
          {/* GROUP 1: CORE SETUP & INTELLIGENCE */}
          <div className="settings-nav-group">
            <div className="settings-nav-group-title">Core Setup</div>
            <button
              type="button"
              onClick={() => handleTabChange('gateway')}
              className={`settings-nav-item ${activeTab === 'gateway' ? 'active' : ''}`}
            >
              <Cpu size={16} /> AI Engine & Models
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('profile')}
              className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            >
              <FileText size={16} /> Master Profile & Resume
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('scrapers')}
              className={`settings-nav-item ${activeTab === 'scrapers' ? 'active' : ''}`}
            >
              <Compass size={16} /> Search Filters & Scrapers
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('sync')}
              className={`settings-nav-item ${activeTab === 'sync' ? 'active' : ''}`}
            >
              <Key size={16} /> Extension Pairing & Sync
            </button>
          </div>

          {/* GROUP 2: ADVANCED AI MODELS */}
          <div className="settings-nav-group">
            <div className="settings-nav-group-title">Advanced AI Models</div>
            <button
              type="button"
              onClick={() => handleTabChange('scorer')}
              className={`settings-nav-item ${activeTab === 'scorer' ? 'active' : ''}`}
            >
              <Bot size={16} /> AI Fit Scorer
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('tailor')}
              className={`settings-nav-item ${activeTab === 'tailor' ? 'active' : ''}`}
            >
              <Sliders size={16} /> AI Resume Tailor
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('copilot')}
              className={`settings-nav-item ${activeTab === 'copilot' ? 'active' : ''}`}
            >
              <Sparkles size={16} /> Copilot & Prompts
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('observability')}
              className={`settings-nav-item ${activeTab === 'observability' ? 'active' : ''}`}
            >
              <Activity size={16} /> Observability &amp; Tracing
            </button>
          </div>

          {/* GROUP 3: PREFERENCES & SYSTEM */}
          <div className="settings-nav-group">
            <div className="settings-nav-group-title">System & UI</div>
            <button
              type="button"
              onClick={() => handleTabChange('general')}
              className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            >
              <Palette size={16} /> Appearance & UI
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('system')}
              className={`settings-nav-item ${activeTab === 'system' ? 'active' : ''}`}
            >
              <Database size={16} /> Telemetry & System
            </button>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="settings-content">
          {loading ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <RefreshCw size={24} className="animate-spin" />
              <span>Loading system configuration from backend...</span>
            </div>
          ) : (
            <div className="settings-tab-content">
              {/* TAB 0: MASTER PROFILE */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <ResumeManager
                      onActiveResumeChange={setHasActiveResume}
                      onThemeChange={(newTheme) =>
                        setFormSettings((prev) => ({ ...prev, tailor_theme: newTheme }))
                      }
                    />
                  </div>
                  {/* Next / Previous Step Footer Navigation */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0 1rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTabChange('gateway')}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ArrowLeft size={15} /> Back to AI Engine
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('scrapers')}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.4rem',
                      }}
                    >
                      Next: Search Filters & Scrapers <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 1: APPEARANCE & INTERFACE */}
              {activeTab === 'general' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        marginBottom: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Palette size={18} style={{ color: 'var(--accent-primary)' }} />
                      Interface & Theme Aesthetics
                    </h3>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Select your preferred system color mode and accent theme palette.
                    </p>

                    {/* Color Mode */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          marginBottom: '0.5rem',
                        }}
                      >
                        Color Mode
                      </label>
                      <div className="mode-selector-group">
                        <button
                          type="button"
                          className={`mode-selector-btn ${tempColorMode === 'system' ? 'active' : ''}`}
                          onClick={() => {
                            setTempColorMode('system');
                            setIsDirty(true);
                          }}
                        >
                          <Laptop size={16} /> Auto (System Match)
                        </button>
                        <button
                          type="button"
                          className={`mode-selector-btn ${tempColorMode === 'dark' ? 'active' : ''}`}
                          onClick={() => {
                            setTempColorMode('dark');
                            setIsDirty(true);
                          }}
                        >
                          <Moon size={16} /> Dark Mode
                        </button>
                        <button
                          type="button"
                          className={`mode-selector-btn ${tempColorMode === 'light' ? 'active' : ''}`}
                          onClick={() => {
                            setTempColorMode('light');
                            setIsDirty(true);
                          }}
                        >
                          <Sun size={16} /> Light Mode
                        </button>
                      </div>
                    </div>

                    {/* Accent Color */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          marginBottom: '0.5rem',
                        }}
                      >
                        Accent Color Palette
                      </label>
                      <div className="accent-selector-group">
                        {ACCENT_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            className={`accent-swatch-btn ${tempAccentTheme === theme.id ? 'active' : ''}`}
                            onClick={() => {
                              setTempAccentTheme(theme.id);
                              setIsDirty(true);
                            }}
                          >
                            <span
                              className="accent-swatch-dot"
                              style={{ background: theme.primaryColor }}
                            />
                            {theme.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Threshold Setting */}
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        Global Fit Score Qualification Threshold
                      </h3>
                      {renderSourceBadge('scorer_threshold')}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1rem',
                      }}
                    >
                      Jobs scoring at or above this threshold qualify as &ldquo;Qualified&rdquo; and
                      trigger automatic resume tailoring.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formSettings.scorer_threshold}
                        onChange={(e) =>
                          handleFieldChange('scorer_threshold', Number(e.target.value) || 0)
                        }
                        style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          minWidth: '80px',
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formSettings.scorer_threshold}
                          onChange={(e) =>
                            handleFieldChange('scorer_threshold', Number(e.target.value) || 0)
                          }
                          className="input-text"
                          style={{ width: '70px', padding: '0.4rem' }}
                        />
                        <span style={{ fontWeight: 600 }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: DEFAULT AI GATEWAY */}
              {activeTab === 'gateway' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
                        Default AI Gateway (Primary Model & Credentials)
                      </h3>
                      {renderSourceBadge('default_llm_model')}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Configures the primary AI provider, default model, and credentials. AI Fit
                      Scorer, Resume Tailor, and Copilot inherit from this gateway automatically
                      unless you configure a custom override.
                    </p>

                    {/* Primary Provider Selector */}
                    {renderProviderSelect(
                      selectedDefaultProvider,
                      handleSelectDefaultProvider,
                      'Primary LLM Provider',
                      'default-llm-provider-select'
                    )}

                    {/* Fixed Built-in or Custom Base URL */}
                    {renderEndpointBaseUrlSection(
                      selectedDefaultProvider,
                      formSettings.default_llm_api_base,
                      (val) => handleFieldChange('default_llm_api_base', val),
                      'Gateway Endpoint Base URL',
                      'default_llm_api_base',
                      'default-llm-api-base'
                    )}

                    {/* API Key */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {(() => {
                            const p = LLM_PROVIDERS.find((x) => x.id === selectedDefaultProvider);
                            return `${p?.name || 'Primary'} API Key`;
                          })()}
                        </label>
                        {renderSourceBadge('default_llm_api_key')}
                      </div>

                      {!editingDefaultKey ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <div
                            style={{
                              flex: 1,
                              padding: '0.55rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-subtle)',
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              color: formSettings.default_llm_api_key
                                ? 'var(--text-primary)'
                                : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                            {formSettings.default_llm_api_key || 'No gateway API key configured'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingDefaultKey(true)}
                            className="btn btn-secondary btn-sm"
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            <Unlock size={14} /> Change Key
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="password"
                            value={newDefaultKey}
                            onChange={(e) => {
                              setNewDefaultKey(e.target.value);
                              setIsDirty(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newDefaultKey.trim() && !saving) {
                                e.preventDefault();
                                handleSaveAll();
                              }
                            }}
                            className="input-text"
                            placeholder={
                              LLM_PROVIDERS.find((x) => x.id === selectedDefaultProvider)
                                ?.keyPlaceholder || 'Enter API key (e.g. sk-...)'
                            }
                            style={{ flex: 1 }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAll()}
                            disabled={saving || !newDefaultKey.trim()}
                            className="btn btn-primary btn-sm"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDefaultKey(false);
                              setNewDefaultKey('');
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.3rem',
                          display: 'block',
                        }}
                      >
                        {LLM_PROVIDERS.find((x) => x.id === selectedDefaultProvider)?.keyHelp ||
                          'API key used by all engines inheriting from this gateway.'}
                      </span>
                    </div>

                    {/* Default Model Selection with Tip & Live Fetch */}
                    {(() => {
                      const providerMeta =
                        LLM_PROVIDERS.find((p) => p.id === selectedDefaultProvider) ||
                        LLM_PROVIDERS[0];
                      return (
                        <ModelSelectionRow
                          id="default-llm-model"
                          label="Default Model Identifier (e.g. openrouter/model or openai/model)"
                          placeholder="openrouter/openrouter/free"
                          value={formSettings.default_llm_model || ''}
                          onChange={(val) => {
                            handleFieldChange('default_llm_model', val);
                            setIsDirty(true);
                            const current = LLM_PROVIDERS.find(
                              (p) => p.id === selectedDefaultProvider
                            );
                            const hasKnownPrefix = LLM_PROVIDERS.some((p) =>
                              val.toLowerCase().startsWith(`${p.id}/`)
                            );
                            const detected = detectProviderFromModel(val);
                            if (
                              hasKnownPrefix &&
                              !current?.isCustom &&
                              !current?.isLocal &&
                              detected &&
                              detected !== selectedDefaultProvider
                            ) {
                              setSelectedDefaultProvider(detected);
                              handleFieldChange('default_llm_provider', detected);
                            }
                          }}
                          datalistId="default-model-suggestions"
                          tipText="Tip: Choose a balanced workhorse model for general tasks, or configure dedicated fast/thinking models per feature below."
                          fallbackModels={providerMeta.recommendedModels}
                          isFetching={fetchingModelsFeature === 'gateway'}
                          fetchedModels={fetchedModelsMap.gateway || []}
                          providerName={providerMeta.name}
                          onFetch={() =>
                            handleFetchModels(
                              'gateway',
                              selectedDefaultProvider,
                              formSettings.default_llm_api_key || '',
                              formSettings.default_llm_api_base || '',
                              formSettings.default_llm_model
                            )
                          }
                          helpText="This model is used across AI Fit Scorer, Resume Tailoring, and Copilot by default."
                        />
                      );
                    })()}

                    {/* Test Connection */}
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            Test LLM Connectivity
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Send a minimal 1-token test prompt via LiteLLM to verify model routing
                            and credentials.
                          </div>
                          <LlmTestTarget id="gateway" target={gatewayTestTarget} />
                        </div>
                        <button
                          type="button"
                          data-testid="test-gateway-llm-btn"
                          onClick={() => handleTestLlm('gateway')}
                          disabled={testingDefaultLlm}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          {testingDefaultLlm ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" /> Testing...
                            </>
                          ) : (
                            <>
                              <Send size={14} /> Test Connection
                            </>
                          )}
                        </button>
                      </div>

                      {defaultTestResult && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: defaultTestResult.success
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                            color: defaultTestResult.success
                              ? 'var(--color-success, #10b981)'
                              : 'var(--color-error, #ef4444)',
                            border: `1px solid ${
                              defaultTestResult.success
                                ? 'rgba(16, 185, 129, 0.25)'
                                : 'rgba(239, 68, 68, 0.25)'
                            }`,
                          }}
                        >
                          {defaultTestResult.success ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          <span>
                            <span>
                              {defaultTestResult.message || defaultTestResult.error}
                              {defaultTestResult.latencyMs !== undefined
                                ? ` (${defaultTestResult.latencyMs}ms)`
                                : ''}
                            </span>
                            {defaultTestResult.apiBase ? (
                              <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8 }}>
                                Endpoint: {defaultTestResult.apiBase}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gateway Inheritance Status Card */}
                  <div className="settings-card" style={{ padding: '1.25rem' }}>
                    <h4
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <ShieldCheck size={16} style={{ color: 'var(--accent-primary)' }} />
                      Engine Inheritance Overview
                    </h4>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '0.75rem',
                      }}
                    >
                      {[
                        {
                          name: 'AI Fit Scorer',
                          inheritDefault: formSettings.scorer_inherit_default,
                          inheritModel: formSettings.scorer_inherit_model,
                          model: formSettings.scorer_model,
                        },
                        {
                          name: 'Resume Tailor',
                          inheritDefault: formSettings.tailor_inherit_default,
                          inheritModel: formSettings.tailor_inherit_model,
                          model: formSettings.tailor_model,
                        },
                        {
                          name: 'Copilot & Prompts',
                          inheritDefault: formSettings.copilot_inherit_default,
                          inheritModel: formSettings.copilot_inherit_model,
                          model: formSettings.copilot_model,
                        },
                      ].map((card) => (
                        <div
                          key={card.name}
                          style={{
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div
                            style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}
                          >
                            {card.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color:
                                card.inheritDefault !== false
                                  ? 'var(--color-success, #10b981)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {card.inheritDefault !== false
                              ? card.inheritModel !== false
                                ? '✓ Inheriting Provider & Model'
                                : `✓ Inheriting Provider (${card.model || 'Custom Model'})`
                              : 'Using Custom Override'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Collapsible Advanced AI Model Overrides (Scorer, Tailor, Copilot, Opik) */}
                  <div className="settings-card" style={{ padding: '1.25rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowAdvancedAiOverrides((prev) => !prev)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            Advanced AI Model Overrides
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Customize per-feature models for Fit Scoring, Resume Tailoring, Copilot,
                            or Opik
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        {showAdvancedAiOverrides ? (
                          <>
                            Hide <ChevronDown size={16} />
                          </>
                        ) : (
                          <>
                            Configure Overrides <ChevronRight size={16} />
                          </>
                        )}
                      </button>
                    </div>

                    {showAdvancedAiOverrides && (
                      <div
                        style={{
                          marginTop: '1.25rem',
                          borderTop: '1px solid var(--border-subtle)',
                          paddingTop: '1rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleTabChange('scorer')}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <Bot size={14} /> Open Fit Scorer Tab
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabChange('tailor')}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <Sliders size={14} /> Open Resume Tailor Tab
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabChange('copilot')}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <Sparkles size={14} /> Open Copilot & Prompts Tab
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabChange('observability')}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <Activity size={14} /> Open Observability &amp; Tracing Tab
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Next Step Footer Navigation */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      padding: '1rem 0',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTabChange('profile')}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.4rem',
                      }}
                    >
                      Next: Master Resume & Profile <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: AI FIT SCORER */}
              {activeTab === 'scorer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Bot size={18} style={{ color: 'var(--accent-primary)' }} />
                        LLM Fit Scorer Configuration
                      </h3>
                      {renderSourceBadge('scorer_model')}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Configures the primary AI model used to evaluate ingested jobs against your
                      master resume. LiteLLM handles automated routing across 152+ providers.
                    </p>

                    {/* Inherit toggle from Default AI Gateway */}
                    <InheritProviderSettingsBlock
                      inheritDefault={formSettings.scorer_inherit_default !== false}
                      onToggleInheritDefault={(val) => {
                        handleFieldChange('scorer_inherit_default', val);
                        setIsDirty(true);
                      }}
                      inheritModel={formSettings.scorer_inherit_model !== false}
                      onToggleInheritModel={(val) => {
                        handleFieldChange('scorer_inherit_model', val);
                        setIsDirty(true);
                      }}
                      featureName="job fit scoring"
                      defaultProviderName={
                        LLM_PROVIDERS.find((p) => p.id === selectedDefaultProvider)?.name ||
                        'Default Gateway'
                      }
                      defaultModel={formSettings.default_llm_model}
                    >
                      <InheritedCustomModelSection
                        id="custom-scorer-model"
                        label="Custom Scorer Model Identifier"
                        placeholder="openrouter/google/gemini-2.5-flash"
                        value={formSettings.scorer_model}
                        onChange={(val) => {
                          handleFieldChange('scorer_model', val);
                          setIsDirty(true);
                        }}
                        preferredTier="fast"
                        selectedDefaultProvider={selectedDefaultProvider}
                        datalistId="scorer-model-suggestions"
                        featureName="Scorer"
                        icon="zap"
                        onFetchModels={() =>
                          handleFetchModels(
                            'scorer',
                            selectedDefaultProvider,
                            formSettings.default_llm_api_key || '',
                            formSettings.default_llm_api_base || '',
                            formSettings.scorer_model
                          )
                        }
                        isFetching={fetchingModelsFeature === 'scorer'}
                        fetchedModels={fetchedModelsMap.scorer || []}
                      />
                    </InheritProviderSettingsBlock>

                    {formSettings.scorer_inherit_default === false && (
                      <>
                        {/* Primary Provider Selector */}
                        {renderProviderSelect(
                          selectedScorerProvider,
                          handleSelectScorerProvider,
                          'Primary LLM Provider',
                          'scorer-llm-provider-select'
                        )}

                        {/* Fixed Built-in or Custom Base URL */}
                        {renderEndpointBaseUrlSection(
                          selectedScorerProvider,
                          formSettings.scorer_api_base,
                          (val) => handleFieldChange('scorer_api_base', val),
                          'LLM Endpoint Base URL',
                          'scorer_api_base',
                          'scorer-api-base'
                        )}

                        {/* API Key */}
                        <div style={{ marginBottom: '1.25rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                              {(() => {
                                const p = LLM_PROVIDERS.find(
                                  (x) => x.id === selectedScorerProvider
                                );
                                return `${p?.name || 'LLM'} API Key`;
                              })()}
                            </label>
                            {renderSourceBadge('scorer_api_key')}
                          </div>

                          {!editingScorerKey ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  color: formSettings.scorer_api_key
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                {formSettings.scorer_api_key || 'No API key configured'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingScorerKey(true)}
                                className="btn btn-secondary btn-sm"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <Unlock size={14} /> Change Key
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="password"
                                value={newScorerKey}
                                onChange={(e) => {
                                  setNewScorerKey(e.target.value);
                                  setIsDirty(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newScorerKey.trim() && !saving) {
                                    e.preventDefault();
                                    handleSaveAll();
                                  }
                                }}
                                className="input-text"
                                placeholder={
                                  LLM_PROVIDERS.find((x) => x.id === selectedScorerProvider)
                                    ?.keyPlaceholder || 'Enter API key (e.g. sk-...)'
                                }
                                style={{ flex: 1 }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAll()}
                                disabled={saving || !newScorerKey.trim()}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingScorerKey(false);
                                  setNewScorerKey('');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              marginTop: '0.25rem',
                              display: 'block',
                            }}
                          >
                            {LLM_PROVIDERS.find((x) => x.id === selectedScorerProvider)?.keyHelp ||
                              'Your API key is securely encrypted and stored locally.'}
                          </span>
                        </div>

                        {/* Dedicated Scorer Model Selection with Tip & Live Fetch */}
                        {(() => {
                          const providerMeta =
                            LLM_PROVIDERS.find((p) => p.id === selectedScorerProvider) ||
                            LLM_PROVIDERS[0];
                          const fastModels = providerMeta.recommendedModels.filter(
                            (m) => m.tier === 'fast'
                          );
                          const fallbackModels =
                            fastModels.length > 0 ? fastModels : providerMeta.recommendedModels;

                          return (
                            <ModelSelectionRow
                              id="scorer-model"
                              label="Scorer Model Identifier (e.g. openrouter/model or openai/model)"
                              placeholder="openrouter/z-ai/glm-5.3-flash"
                              value={formSettings.scorer_model}
                              onChange={(val) => {
                                handleFieldChange('scorer_model', val);
                                setIsDirty(true);
                                const current = LLM_PROVIDERS.find(
                                  (p) => p.id === selectedScorerProvider
                                );
                                const hasKnownPrefix = LLM_PROVIDERS.some((p) =>
                                  val.toLowerCase().startsWith(`${p.id}/`)
                                );
                                const detected = detectProviderFromModel(val);
                                if (
                                  hasKnownPrefix &&
                                  !current?.isCustom &&
                                  !current?.isLocal &&
                                  detected !== selectedScorerProvider
                                ) {
                                  setSelectedScorerProvider(detected);
                                  handleFieldChange('scorer_provider', detected);
                                }
                              }}
                              datalistId="scorer-model-suggestions"
                              tipText="Tip: For AI Fit Scorer, choose fast, cost-effective models (e.g. Flash, Mini, Haiku) to screen jobs quickly with low token costs."
                              fallbackModels={fallbackModels}
                              isFetching={fetchingModelsFeature === 'scorer'}
                              fetchedModels={fetchedModelsMap.scorer || []}
                              providerName={providerMeta.name}
                              onFetch={() =>
                                handleFetchModels(
                                  'scorer',
                                  selectedScorerProvider,
                                  formSettings.scorer_api_key || '',
                                  formSettings.scorer_api_base || '',
                                  formSettings.scorer_model
                                )
                              }
                              helpText="LiteLLM supports 2,500+ models. Select from fetched models, suggestions, or type any valid model identifier."
                            />
                          );
                        })()}
                      </>
                    )}

                    {/* Live Test LLM Connection */}
                    <div
                      style={{
                        background: 'rgba(99, 102, 241, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            Test LLM Connectivity
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Send a minimal 1-token test prompt via LiteLLM to verify model routing
                            and credentials using{' '}
                            {formSettings.scorer_inherit_default !== false
                              ? `inherited gateway credentials (${formSettings.scorer_inherit_model !== false ? formSettings.default_llm_model : formSettings.scorer_model})`
                              : 'custom scorer credentials'}
                            .
                          </div>
                          <LlmTestTarget id="scorer" target={scorerTestTarget} />
                        </div>
                        <button
                          type="button"
                          data-testid="test-llm-btn"
                          onClick={() => handleTestLlm('scorer')}
                          disabled={testingLlm}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          {testingLlm ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" /> Testing...
                            </>
                          ) : (
                            <>
                              <Send size={14} /> Test Connection
                            </>
                          )}
                        </button>
                      </div>

                      {testResult && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            background: testResult.success
                              ? 'var(--color-green-bg)'
                              : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: testResult.success ? 'var(--color-green)' : 'var(--color-red)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          {testResult.success ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          <span>
                            <span>
                              {testResult.message || testResult.error}
                              {testResult.latencyMs !== undefined
                                ? ` (${testResult.latencyMs}ms)`
                                : ''}
                            </span>
                            {testResult.apiBase ? (
                              <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8 }}>
                                Endpoint: {testResult.apiBase}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AI RESUME TAILOR */}
              {activeTab === 'tailor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
                        Resume Tailoring Engine (resume-ops)
                      </h3>
                      {renderSourceBadge('tailor_model')}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Controls the AI model that rewrites experience bullets, highlights skills, and
                      compiles tailored PDF resumes.
                    </p>

                    {/* Inherit toggle from Default AI Gateway */}
                    <InheritProviderSettingsBlock
                      inheritDefault={formSettings.tailor_inherit_default !== false}
                      onToggleInheritDefault={(val) => {
                        handleFieldChange('tailor_inherit_default', val);
                        setIsDirty(true);
                      }}
                      inheritModel={formSettings.tailor_inherit_model !== false}
                      onToggleInheritModel={(val) => {
                        handleFieldChange('tailor_inherit_model', val);
                        setIsDirty(true);
                      }}
                      featureName="high-capacity resume tailoring"
                      defaultProviderName={
                        LLM_PROVIDERS.find((p) => p.id === selectedDefaultProvider)?.name ||
                        'Default Gateway'
                      }
                      defaultModel={formSettings.default_llm_model}
                    >
                      <InheritedCustomModelSection
                        id="custom-tailor-model"
                        label="Custom Tailoring Model Identifier"
                        placeholder="openrouter/anthropic/claude-3.5-sonnet"
                        value={formSettings.tailor_model}
                        onChange={(val) => {
                          handleFieldChange('tailor_model', val);
                          setIsDirty(true);
                        }}
                        preferredTier="reasoning"
                        selectedDefaultProvider={selectedDefaultProvider}
                        datalistId="tailor-model-suggestions"
                        featureName="Tailoring"
                        icon="sparkles"
                        onFetchModels={() =>
                          handleFetchModels(
                            'tailor',
                            selectedDefaultProvider,
                            formSettings.default_llm_api_key || '',
                            formSettings.default_llm_api_base || '',
                            formSettings.tailor_model
                          )
                        }
                        isFetching={fetchingModelsFeature === 'tailor'}
                        fetchedModels={fetchedModelsMap.tailor || []}
                      />
                    </InheritProviderSettingsBlock>

                    {/* If NOT inherited, show dedicated provider selector, key, and model */}
                    {formSettings.tailor_inherit_default === false && (
                      <>
                        <div
                          style={{
                            marginBottom: '1.25rem',
                            padding: '1rem',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          {/* Tailor Dedicated Provider */}
                          {renderProviderSelect(
                            selectedTailorProvider,
                            handleSelectTailorProvider,
                            'Tailor Dedicated Provider',
                            'tailor-llm-provider-select'
                          )}

                          {/* Fixed Built-in or Custom Base URL */}
                          {renderEndpointBaseUrlSection(
                            selectedTailorProvider,
                            formSettings.tailor_api_base,
                            (val) => handleFieldChange('tailor_api_base', val),
                            'Dedicated Endpoint Base URL',
                            'tailor_api_base',
                            'tailor-api-base'
                          )}

                          {/* Dedicated Tailor Key */}
                          <div style={{ marginBottom: '1rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                Dedicated Tailor API Key
                              </label>
                              {renderSourceBadge('tailor_api_key')}
                            </div>
                            {!editingTailorKey ? (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div
                                  style={{
                                    flex: 1,
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-subtle)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    color: formSettings.tailor_api_key
                                      ? 'var(--text-primary)'
                                      : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                  {formSettings.tailor_api_key || 'No dedicated key set'}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingTailorKey(true)}
                                  className="btn btn-secondary btn-sm"
                                >
                                  <Unlock size={14} /> Change Key
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  type="password"
                                  value={newTailorKey}
                                  onChange={(e) => {
                                    setNewTailorKey(e.target.value);
                                    setIsDirty(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newTailorKey.trim() && !saving) {
                                      e.preventDefault();
                                      handleSaveAll();
                                    }
                                  }}
                                  className="input-text"
                                  placeholder="Enter custom key for tailor service"
                                  style={{ flex: 1 }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveAll()}
                                  disabled={saving || !newTailorKey.trim()}
                                  className="btn btn-primary btn-sm"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTailorKey(false);
                                    setNewTailorKey('');
                                  }}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Dedicated Tailor Model Selection with Tip & Live Fetch */}
                        {(() => {
                          const effectiveProvider = selectedTailorProvider;
                          const providerMeta =
                            LLM_PROVIDERS.find((p) => p.id === effectiveProvider) ||
                            LLM_PROVIDERS[0];
                          const reasoningModels = providerMeta.recommendedModels.filter(
                            (m) => m.tier === 'reasoning'
                          );
                          const fallbackModels =
                            reasoningModels.length > 0
                              ? reasoningModels
                              : providerMeta.recommendedModels;

                          return (
                            <ModelSelectionRow
                              id="tailor-model"
                              label="Tailoring Model Identifier"
                              placeholder="openrouter/deepseek/deepseek-v4.1-pro"
                              value={formSettings.tailor_model}
                              onChange={(val) => {
                                handleFieldChange('tailor_model', val);
                                setIsDirty(true);
                              }}
                              datalistId="tailor-model-suggestions"
                              tipText="Tip: For Resume Tailoring & Copilot, choose deep reasoning or thinking models for superior ATS alignment and nuanced writing."
                              fallbackModels={fallbackModels}
                              isFetching={fetchingModelsFeature === 'tailor'}
                              fetchedModels={fetchedModelsMap.tailor || []}
                              providerName={providerMeta.name}
                              onFetch={() =>
                                handleFetchModels(
                                  'tailor',
                                  selectedTailorProvider,
                                  formSettings.tailor_api_key || '',
                                  formSettings.tailor_api_base || '',
                                  formSettings.tailor_model
                                )
                              }
                              helpText="Thinking and reasoning models ensure truthful adherence to your candidate facts and job keywords."
                            />
                          );
                        })()}
                      </>
                    )}

                    {/* Default Resume Theme */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          Default Resume Theme
                        </label>
                        {renderSourceBadge('tailor_theme')}
                      </div>
                      <select
                        value={formSettings.tailor_theme}
                        onChange={(e) => handleFieldChange('tailor_theme', e.target.value)}
                        className="input-text"
                      >
                        {
                          // Keep a profile's stored theme selectable even once it
                          // is retired from the curated gallery, otherwise saving
                          // the form would silently rewrite it to the first option.
                          findThemeMetadata(formSettings.tailor_theme) === undefined && (
                            <option value={formSettings.tailor_theme}>
                              {formSettings.tailor_theme} (legacy)
                            </option>
                          )
                        }
                        {THEME_CATALOG.map((theme) => (
                          <option key={theme.slug} value={theme.slug}>
                            {theme.name} ({theme.badges.join(', ')})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Resume Tailoring Style */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          Resume Tailoring Style
                        </label>
                        {renderSourceBadge('tailor_style')}
                      </div>
                      <select
                        value={formSettings.tailor_style || 'executive'}
                        onChange={(e) => handleFieldChange('tailor_style', e.target.value)}
                        className="input-text"
                      >
                        <option value="executive">
                          Executive (High-impact leadership & scale metrics)
                        </option>
                        <option value="tech">
                          Tech (Deep technical architecture & tooling focus)
                        </option>
                        <option value="concise">Concise (Dense, single-line action bullets)</option>
                        <option value="academic">
                          Academic (Methodologies & publications focus)
                        </option>
                      </select>
                    </div>

                    {/* Pipeline Execution Mode */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          Pipeline Execution Mode
                        </label>
                        {renderSourceBadge('tailor_pipeline_mode')}
                      </div>
                      <select
                        value={formSettings.tailor_pipeline_mode || 'sequential'}
                        onChange={(e) => handleFieldChange('tailor_pipeline_mode', e.target.value)}
                        className="input-text"
                      >
                        <option value="sequential">
                          Sequential Cascade (Deep Coherence - cross-section aware) [Default]
                        </option>
                        <option value="parallel">
                          Parallel Fan-out (Fast concurrent sections - ~5-10s)
                        </option>
                        <option value="monolithic">
                          Monolithic Single-Pass (Whole resume tailored at once)
                        </option>
                      </select>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                          display: 'block',
                        }}
                      >
                        Sequential Cascade chains sections (Basics → Work → Projects → Skills) so
                        downstream sections avoid duplicating accomplishments and align narratives.
                      </span>
                    </div>

                    {/* Custom Tailoring Instructions */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          Custom Tailoring Instructions
                        </label>
                        {renderSourceBadge('tailor_instructions')}
                      </div>
                      <textarea
                        rows={6}
                        value={formSettings.tailor_instructions || ''}
                        onChange={(e) => handleFieldChange('tailor_instructions', e.target.value)}
                        className="input-text"
                        style={{
                          width: '100%',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          resize: 'vertical',
                        }}
                        placeholder={
                          'Custom instructions that apply across all sections (e.g. Tone, British English, avoid em dashes, candidate archetype, dropping courses or keywords):\n\n' +
                          '- Maximise candidate chances through aggressive, truthful positioning\n' +
                          '- Use British English. Avoid em dashes.\n' +
                          '- Candidate Archetype: Hands-on technical generalist\n' +
                          '- Drop courses under education. Drop standalone keywords lists under projects.'
                        }
                      />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                          display: 'block',
                        }}
                      >
                        Injected directly into the tailoring strategy and section prompts to guide
                        candidate voice, terminology, and formatting constraints.
                      </span>
                    </div>

                    {/* Final Verification & Quality Pass */}
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(formSettings.tailor_enable_final_check)}
                            onChange={(e) =>
                              handleFieldChange('tailor_enable_final_check', e.target.checked)
                            }
                          />
                          Enable Final Check / Critic Pass
                        </label>
                        {renderSourceBadge('tailor_enable_final_check')}
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.35rem',
                          display: 'block',
                        }}
                      >
                        Performs an automated quality and fact-checking audit against the master
                        resume and custom instructions before compiling the final PDF.
                      </span>

                      {formSettings.tailor_enable_final_check && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              marginBottom: '0.25rem',
                            }}
                          >
                            Critic / Auditor Model (Optional)
                          </label>
                          <input
                            type="text"
                            list="critic-model-suggestions"
                            value={formSettings.tailor_final_check_model || ''}
                            onChange={(e) =>
                              handleFieldChange('tailor_final_check_model', e.target.value)
                            }
                            className="input-text"
                            placeholder="Leave empty to use primary tailoring model, or enter reasoning model (e.g. openrouter/anthropic/claude-3.5-sonnet)"
                          />
                          <datalist id="critic-model-suggestions">
                            {ALL_RECOMMENDED_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.provider}) - {m.description}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      )}
                    </div>

                    {/* Expandable Section Prompt Templates */}
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-glass)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowTailorPromptTemplates(!showTailorPromptTemplates)}
                        style={{
                          width: '100%',
                          padding: '0.85rem 1rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ChevronRight
                            size={16}
                            style={{
                              transform: showTailorPromptTemplates ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.2s ease',
                              color: 'var(--accent-primary)',
                            }}
                          />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Section Prompt Templates & Instructions Overrides
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {showTailorPromptTemplates ? 'Hide Overrides' : 'Customize Overrides'}
                        </span>
                      </button>

                      {showTailorPromptTemplates && (
                        <div
                          style={{
                            padding: '0 1rem 1rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            borderTop: '1px solid var(--border-subtle)',
                          }}
                        >
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.75rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Fine-tune the exact system instructions given to the LLM for each resume
                            section. Click "Default" on any template to restore factory prompt.
                          </p>

                          {/* Strategy & Basics */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                Strategy & Basics Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (defaultPromptTemplates.tailor_prompt_strategy_and_basics) {
                                    handleFieldChange(
                                      'tailor_prompt_strategy_and_basics',
                                      defaultPromptTemplates.tailor_prompt_strategy_and_basics
                                    );
                                    toast.info('Strategy prompt restored to default');
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '0.2rem' }} /> Default
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={formSettings.tailor_prompt_strategy_and_basics || ''}
                              onChange={(e) =>
                                handleFieldChange(
                                  'tailor_prompt_strategy_and_basics',
                                  e.target.value
                                )
                              }
                              placeholder={
                                defaultPromptTemplates.tailor_prompt_strategy_and_basics ||
                                'Strategy prompt...'
                              }
                              className="input-text"
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            />
                          </div>

                          {/* Work Experience */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                Work Experience Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (defaultPromptTemplates.tailor_prompt_work) {
                                    handleFieldChange(
                                      'tailor_prompt_work',
                                      defaultPromptTemplates.tailor_prompt_work
                                    );
                                    toast.info('Work prompt restored to default');
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '0.2rem' }} /> Default
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={formSettings.tailor_prompt_work || ''}
                              onChange={(e) =>
                                handleFieldChange('tailor_prompt_work', e.target.value)
                              }
                              placeholder={
                                defaultPromptTemplates.tailor_prompt_work || 'Work prompt...'
                              }
                              className="input-text"
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            />
                          </div>

                          {/* Projects */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                Projects Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (defaultPromptTemplates.tailor_prompt_projects) {
                                    handleFieldChange(
                                      'tailor_prompt_projects',
                                      defaultPromptTemplates.tailor_prompt_projects
                                    );
                                    toast.info('Projects prompt restored to default');
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '0.2rem' }} /> Default
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={formSettings.tailor_prompt_projects || ''}
                              onChange={(e) =>
                                handleFieldChange('tailor_prompt_projects', e.target.value)
                              }
                              placeholder={
                                defaultPromptTemplates.tailor_prompt_projects ||
                                'Projects prompt...'
                              }
                              className="input-text"
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            />
                          </div>

                          {/* Qualifications & Skills */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                Qualifications & Skills Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (defaultPromptTemplates.tailor_prompt_qualifications) {
                                    handleFieldChange(
                                      'tailor_prompt_qualifications',
                                      defaultPromptTemplates.tailor_prompt_qualifications
                                    );
                                    toast.info('Qualifications prompt restored to default');
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '0.2rem' }} /> Default
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={formSettings.tailor_prompt_qualifications || ''}
                              onChange={(e) =>
                                handleFieldChange('tailor_prompt_qualifications', e.target.value)
                              }
                              placeholder={
                                defaultPromptTemplates.tailor_prompt_qualifications ||
                                'Qualifications prompt...'
                              }
                              className="input-text"
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            />
                          </div>

                          {/* Monolithic Full-Resume */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                Monolithic (Whole Resume) Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (defaultPromptTemplates.tailor_prompt_monolithic) {
                                    handleFieldChange(
                                      'tailor_prompt_monolithic',
                                      defaultPromptTemplates.tailor_prompt_monolithic
                                    );
                                    toast.info('Monolithic prompt restored to default');
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '0.2rem' }} /> Default
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={formSettings.tailor_prompt_monolithic || ''}
                              onChange={(e) =>
                                handleFieldChange('tailor_prompt_monolithic', e.target.value)
                              }
                              placeholder={
                                defaultPromptTemplates.tailor_prompt_monolithic ||
                                'Monolithic prompt...'
                              }
                              className="input-text"
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            />
                          </div>

                          {/* Final Check Critic */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.35rem',
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                Final Check Critic Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (defaultPromptTemplates.tailor_prompt_final_check) {
                                    handleFieldChange(
                                      'tailor_prompt_final_check',
                                      defaultPromptTemplates.tailor_prompt_final_check
                                    );
                                    toast.info('Final check prompt restored to default');
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '0.2rem' }} /> Default
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={formSettings.tailor_prompt_final_check || ''}
                              onChange={(e) =>
                                handleFieldChange('tailor_prompt_final_check', e.target.value)
                              }
                              placeholder={
                                defaultPromptTemplates.tailor_prompt_final_check ||
                                'Final check prompt...'
                              }
                              className="input-text"
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tailor Timeout */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          Tailoring Timeout (Seconds)
                        </label>
                        {renderSourceBadge('tailor_timeout_seconds')}
                      </div>
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={formSettings.tailor_timeout_seconds}
                        onChange={(e) =>
                          handleFieldChange('tailor_timeout_seconds', Number(e.target.value) || 900)
                        }
                        className="input-text"
                      />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                          display: 'block',
                        }}
                      >
                        Maximum time to allow multi-stage LLM resume rewriting and Puppeteer PDF
                        rendering (Default: 900s / 15m).
                      </span>
                    </div>

                    {/* Live Test Tailor LLM Connection */}
                    <div
                      style={{
                        background: 'rgba(99, 102, 241, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            Test Tailoring Model Connectivity
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Verify model access and token generation using{' '}
                            {formSettings.tailor_inherit_default !== false
                              ? `inherited gateway credentials (${formSettings.tailor_inherit_model !== false ? formSettings.default_llm_model : formSettings.tailor_model})`
                              : 'custom tailor credentials'}
                            .
                          </div>
                          <LlmTestTarget id="tailor" target={tailorTestTarget} />
                        </div>
                        <button
                          type="button"
                          data-testid="test-tailor-llm-btn"
                          onClick={() => handleTestLlm('tailor')}
                          disabled={testingTailorLlm}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          {testingTailorLlm ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" /> Testing...
                            </>
                          ) : (
                            <>
                              <Send size={14} /> Test Tailor Model
                            </>
                          )}
                        </button>
                      </div>

                      {tailorTestResult && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            background: tailorTestResult.success
                              ? 'var(--color-green-bg)'
                              : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${tailorTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: tailorTestResult.success
                              ? 'var(--color-green)'
                              : 'var(--color-red)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          {tailorTestResult.success ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          <span>
                            <span>
                              {tailorTestResult.message || tailorTestResult.error}
                              {tailorTestResult.latencyMs !== undefined
                                ? ` (${tailorTestResult.latencyMs}ms)`
                                : ''}
                            </span>
                            {tailorTestResult.apiBase ? (
                              <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8 }}>
                                Endpoint: {tailorTestResult.apiBase}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: COPILOT & PROMPTS */}
              {activeTab === 'copilot' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* CARD 1: Model & Provider Configuration */}
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                        Application & Outreach Copilot Model
                      </h3>
                      {renderSourceBadge('copilot_model')}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Powers LinkedIn recruiter connection notes, custom screening question answers,
                      and tailored cover letters.
                    </p>

                    {/* Inherit Toggle */}
                    <InheritProviderSettingsBlock
                      inheritDefault={formSettings.copilot_inherit_default !== false}
                      onToggleInheritDefault={(val) => {
                        handleFieldChange('copilot_inherit_default', val);
                        setIsDirty(true);
                      }}
                      inheritModel={formSettings.copilot_inherit_model !== false}
                      onToggleInheritModel={(val) => {
                        handleFieldChange('copilot_inherit_model', val);
                        setIsDirty(true);
                      }}
                      featureName="Copilot drafts"
                      defaultProviderName={
                        LLM_PROVIDERS.find((p) => p.id === selectedDefaultProvider)?.name ||
                        'Default Gateway'
                      }
                      defaultModel={formSettings.default_llm_model}
                    >
                      <InheritedCustomModelSection
                        id="custom-copilot-model"
                        label="Custom Copilot Model Identifier"
                        placeholder="openrouter/anthropic/claude-3.5-sonnet"
                        value={formSettings.copilot_model || ''}
                        onChange={(val) => {
                          handleFieldChange('copilot_model', val);
                          setIsDirty(true);
                        }}
                        selectedDefaultProvider={selectedDefaultProvider}
                        datalistId="copilot-model-suggestions"
                        featureName="Copilot"
                        icon="sparkles"
                        onFetchModels={() =>
                          handleFetchModels(
                            'copilot',
                            selectedDefaultProvider,
                            formSettings.default_llm_api_key || '',
                            formSettings.default_llm_api_base || '',
                            formSettings.copilot_model
                          )
                        }
                        isFetching={fetchingModelsFeature === 'copilot'}
                        fetchedModels={fetchedModelsMap.copilot || []}
                      />
                    </InheritProviderSettingsBlock>

                    {/* Dedicated Copilot Provider & Key if NOT inherited */}
                    {formSettings.copilot_inherit_default === false && (
                      <div
                        style={{
                          marginBottom: '1.25rem',
                          padding: '1rem',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        {/* Copilot Dedicated Provider */}
                        {renderProviderSelect(
                          selectedCopilotProvider,
                          handleSelectCopilotProvider,
                          'Copilot Dedicated Provider',
                          'copilot-llm-provider-select'
                        )}

                        {/* Fixed Built-in or Custom Base URL */}
                        {renderEndpointBaseUrlSection(
                          selectedCopilotProvider,
                          formSettings.copilot_api_base,
                          (val) => handleFieldChange('copilot_api_base', val),
                          'Copilot Endpoint Base URL',
                          'copilot_api_base',
                          'copilot-api-base'
                        )}

                        {/* Dedicated Copilot Key */}
                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                              Dedicated Copilot API Key
                            </label>
                            {renderSourceBadge('copilot_api_key')}
                          </div>
                          {!editingCopilotKey ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  color: formSettings.copilot_api_key
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                {formSettings.copilot_api_key || 'No dedicated key set'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingCopilotKey(true)}
                                className="btn btn-secondary btn-sm"
                              >
                                <Unlock size={14} /> Change Key
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="password"
                                value={newCopilotKey}
                                onChange={(e) => {
                                  setNewCopilotKey(e.target.value);
                                  setIsDirty(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newCopilotKey.trim() && !saving) {
                                    e.preventDefault();
                                    handleSaveAll();
                                  }
                                }}
                                className="input-text"
                                placeholder="Enter custom key for Copilot"
                                style={{ flex: 1 }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAll()}
                                disabled={saving || !newCopilotKey.trim()}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCopilotKey(false);
                                  setNewCopilotKey('');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Dedicated Copilot Model Selection with Tip & Live Fetch */}
                        <ModelSelectionRow
                          id="copilot-model"
                          label="Copilot Model Identifier"
                          placeholder="openrouter/anthropic/claude-3.5-sonnet"
                          value={formSettings.copilot_model || ''}
                          onChange={(val) => {
                            handleFieldChange('copilot_model', val);
                            setIsDirty(true);
                          }}
                          datalistId="copilot-model-suggestions"
                          tipText="Tip: For Job Copilot, choose conversational or reasoning models for cover letters, Q&A, and recruiter outreach."
                          fallbackModels={ALL_RECOMMENDED_MODELS}
                          isFetching={fetchingModelsFeature === 'copilot'}
                          fetchedModels={fetchedModelsMap.copilot || []}
                          providerName={selectedCopilotProvider}
                          onFetch={() =>
                            handleFetchModels(
                              'copilot',
                              selectedCopilotProvider,
                              formSettings.copilot_api_key || '',
                              formSettings.copilot_api_base || '',
                              formSettings.copilot_model
                            )
                          }
                          helpText="Conversational and reasoning models generate natural, contextual outreach messages."
                        />
                      </div>
                    )}

                    {/* Test Copilot Model Connectivity */}
                    <div
                      style={{
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          Test Copilot Model Connectivity
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Verify LLM token generation using{' '}
                          {formSettings.copilot_inherit_default !== false
                            ? `inherited gateway credentials (${formSettings.copilot_inherit_model !== false ? formSettings.default_llm_model : formSettings.copilot_model})`
                            : 'custom copilot credentials'}
                          .
                        </div>
                        <LlmTestTarget id="copilot" target={copilotTestTarget} />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTestLlm('copilot')}
                        disabled={testingCopilotLlm}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {testingCopilotLlm ? (
                          <>
                            <RefreshCw size={14} className="spin" /> Testing...
                          </>
                        ) : (
                          <>
                            <Zap size={14} /> Test Model
                          </>
                        )}
                      </button>
                    </div>

                    {copilotTestResult && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          background: copilotTestResult.success
                            ? 'var(--color-green-bg)'
                            : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${
                            copilotTestResult.success
                              ? 'rgba(16, 185, 129, 0.3)'
                              : 'rgba(239, 68, 68, 0.3)'
                          }`,
                          color: copilotTestResult.success
                            ? 'var(--color-green)'
                            : 'var(--color-red)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {copilotTestResult.success ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <AlertTriangle size={16} />
                        )}
                        <span>
                          <span>
                            {copilotTestResult.message || copilotTestResult.error}
                            {copilotTestResult.latencyMs !== undefined
                              ? ` (${copilotTestResult.latencyMs}ms)`
                              : ''}
                          </span>
                          {copilotTestResult.apiBase ? (
                            <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8 }}>
                              Endpoint: {copilotTestResult.apiBase}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CARD 2: Grounding & Anti-Slop Constraints */}
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <ShieldCheck size={18} style={{ color: 'var(--color-green)' }} />
                      Ghostwriter Grounding & Anti-Slop Constraints
                    </h3>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Enforce strict truthfulness invariants and eliminate AI buzzwords across all
                      Copilot outputs.
                    </p>

                    {/* Anti-Slop Checkbox */}
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          cursor: 'pointer',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formSettings.copilot_stop_slop_enabled !== false}
                          onChange={(e) => {
                            handleFieldChange('copilot_stop_slop_enabled', e.target.checked);
                            setIsDirty(true);
                          }}
                          style={{
                            accentColor: 'var(--accent-primary)',
                            width: '16px',
                            height: '16px',
                          }}
                        />
                        Anti-Buzzword Clean Tone Filter (Stop-Slop)
                      </label>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.35rem',
                          marginLeft: '1.65rem',
                        }}
                      >
                        Strictly forbids generic AI cliches ("testament to", "spearheaded", "delve
                        into", "pivotal role", "in summary", "tapestry", "pleased to apply") and
                        bans unsubstantiated metrics.
                      </div>
                    </div>

                    {/* Custom Candidate Constraints */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          Custom Candidate Constraints & Focus Instructions
                        </label>
                        {renderSourceBadge('copilot_constraints')}
                      </div>
                      <textarea
                        rows={3}
                        value={formSettings.copilot_constraints || ''}
                        onChange={(e) => handleFieldChange('copilot_constraints', e.target.value)}
                        placeholder="e.g. Do not mention willingness to relocate; emphasize distributed systems and Golang; highlight staff-level architecture experience."
                        className="input-text"
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.3rem',
                        }}
                      >
                        Injected as explicit negative and positive constraints into all Copilot
                        prompt templates.
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: Customizable Prompt Templates */}
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <MessageSquare size={18} style={{ color: 'var(--accent-primary)' }} />
                        Prompt Templates & Instructions
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const keys = [
                            'copilot_system_prompt_template',
                            'copilot_outreach_prompt_template',
                            'copilot_qa_prompt_template',
                            'copilot_cover_letter_prompt_template',
                          ] as const;
                          const available = keys.filter((k) => defaultPromptTemplates[k]);
                          if (available.length === 0) {
                            toast.error('System default prompt templates are not loaded yet');
                            return;
                          }
                          if (!confirm('Reset all Copilot prompt templates to system defaults?'))
                            return;
                          available.forEach((k) =>
                            handleFieldChange(k, defaultPromptTemplates[k] as string)
                          );
                          setIsDirty(true);
                          toast.info('Prompt templates restored to system defaults');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.78rem',
                        }}
                      >
                        <RotateCcw size={13} /> Restore All Defaults
                      </button>
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.5rem',
                      }}
                    >
                      Customize the underlying LLM instructions. Leave empty to use system defaults.
                      Templates accept standard variables like <code>{'{resume_toon}'}</code>,{' '}
                      <code>{'{job_toon}'}</code>, <code>{'{persona}'}</code>,{' '}
                      <code>{'{question}'}</code>.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* System Prompt Template */}
                      <div
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          background: 'var(--bg-glass)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Base System Prompt Template
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (defaultPromptTemplates.copilot_system_prompt_template) {
                                handleFieldChange(
                                  'copilot_system_prompt_template',
                                  defaultPromptTemplates.copilot_system_prompt_template
                                );
                                toast.info('System prompt restored to default');
                              }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            <RotateCcw size={12} style={{ marginRight: '0.25rem' }} /> Default
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={formSettings.copilot_system_prompt_template || ''}
                          onChange={(e) =>
                            handleFieldChange('copilot_system_prompt_template', e.target.value)
                          }
                          placeholder={
                            defaultPromptTemplates.copilot_system_prompt_template ||
                            'System prompt instructions...'
                          }
                          className="input-text"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                      </div>

                      {/* Recruiter Outreach Prompt Template */}
                      <div
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          background: 'var(--bg-glass)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Recruiter Outreach Prompt Template
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (defaultPromptTemplates.copilot_outreach_prompt_template) {
                                handleFieldChange(
                                  'copilot_outreach_prompt_template',
                                  defaultPromptTemplates.copilot_outreach_prompt_template
                                );
                                toast.info('Outreach prompt restored to default');
                              }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            <RotateCcw size={12} style={{ marginRight: '0.25rem' }} /> Default
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={formSettings.copilot_outreach_prompt_template || ''}
                          onChange={(e) =>
                            handleFieldChange('copilot_outreach_prompt_template', e.target.value)
                          }
                          placeholder={
                            defaultPromptTemplates.copilot_outreach_prompt_template ||
                            'Recruiter outreach prompt...'
                          }
                          className="input-text"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                      </div>

                      {/* Screening Q&A Prompt Template */}
                      <div
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          background: 'var(--bg-glass)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Screening Q&A Prompt Template
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (defaultPromptTemplates.copilot_qa_prompt_template) {
                                handleFieldChange(
                                  'copilot_qa_prompt_template',
                                  defaultPromptTemplates.copilot_qa_prompt_template
                                );
                                toast.info('Q&A prompt restored to default');
                              }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            <RotateCcw size={12} style={{ marginRight: '0.25rem' }} /> Default
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={formSettings.copilot_qa_prompt_template || ''}
                          onChange={(e) =>
                            handleFieldChange('copilot_qa_prompt_template', e.target.value)
                          }
                          placeholder={
                            defaultPromptTemplates.copilot_qa_prompt_template || 'Q&A prompt...'
                          }
                          className="input-text"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                      </div>

                      {/* Cover Letter Prompt Template */}
                      <div
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          background: 'var(--bg-glass)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Cover Letter Prompt Template
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (defaultPromptTemplates.copilot_cover_letter_prompt_template) {
                                handleFieldChange(
                                  'copilot_cover_letter_prompt_template',
                                  defaultPromptTemplates.copilot_cover_letter_prompt_template
                                );
                                toast.info('Cover letter prompt restored to default');
                              }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            <RotateCcw size={12} style={{ marginRight: '0.25rem' }} /> Default
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={formSettings.copilot_cover_letter_prompt_template || ''}
                          onChange={(e) =>
                            handleFieldChange(
                              'copilot_cover_letter_prompt_template',
                              e.target.value
                            )
                          }
                          placeholder={
                            defaultPromptTemplates.copilot_cover_letter_prompt_template ||
                            'Cover letter prompt...'
                          }
                          className="input-text"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: OBSERVABILITY & TRACING */}
              {activeTab === 'observability' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                        LLM Observability &amp; Tracing
                      </h3>
                      {(() => {
                        let sourceBadgeKey: keyof SystemSettings = 'opik_project_name';
                        if (activeObservabilityProvider === 'langfuse')
                          sourceBadgeKey = 'langfuse_host';
                        else if (activeObservabilityProvider === 'langsmith')
                          sourceBadgeKey = 'langsmith_project';
                        return renderSourceBadge(sourceBadgeKey);
                      })()}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      Stream prompt tokens, model latencies, cost tracking, and evaluation traces to
                      your preferred LLM observability platform via LiteLLM callbacks.
                    </p>

                    {/* Observability Provider Switcher */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          marginBottom: '0.5rem',
                        }}
                      >
                        Observability Platform
                      </span>
                      <div className="mode-selector-group" style={{ maxWidth: '480px' }}>
                        <button
                          type="button"
                          className={`mode-selector-btn ${activeObservabilityProvider === 'opik' ? 'active' : ''}`}
                          onClick={() => {
                            setActiveObservabilityProvider('opik');
                            handleFieldChange('observability_provider', 'opik');
                          }}
                        >
                          Comet Opik
                        </button>
                        <button
                          type="button"
                          className={`mode-selector-btn ${activeObservabilityProvider === 'langfuse' ? 'active' : ''}`}
                          onClick={() => {
                            setActiveObservabilityProvider('langfuse');
                            handleFieldChange('observability_provider', 'langfuse');
                          }}
                        >
                          Langfuse
                        </button>
                        <button
                          type="button"
                          className={`mode-selector-btn ${activeObservabilityProvider === 'langsmith' ? 'active' : ''}`}
                          onClick={() => {
                            setActiveObservabilityProvider('langsmith');
                            handleFieldChange('observability_provider', 'langsmith');
                          }}
                        >
                          LangSmith
                        </button>
                      </div>
                    </div>

                    {/* PROVIDER 1: COMET OPIK */}
                    {activeObservabilityProvider === 'opik' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            id="opik_enabled"
                            checked={Boolean(formSettings.opik_enabled)}
                            onChange={(e) => handleFieldChange('opik_enabled', e.target.checked)}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--accent-primary)',
                            }}
                          />
                          <label
                            htmlFor="opik_enabled"
                            style={{ fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
                          >
                            Enable Opik Tracing Callbacks
                          </label>
                        </div>

                        {/* Project Name */}
                        <div>
                          <label
                            htmlFor="opik_project_name"
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            Opik Project Name
                          </label>
                          <input
                            id="opik_project_name"
                            type="text"
                            value={formSettings.opik_project_name || ''}
                            onChange={(e) => handleFieldChange('opik_project_name', e.target.value)}
                            className="input-text"
                            placeholder="jobfoundry"
                          />
                        </div>

                        {/* Opik Workspace */}
                        <div>
                          <label
                            htmlFor="opik_workspace"
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            Opik Workspace (Optional)
                          </label>
                          <input
                            id="opik_workspace"
                            type="text"
                            value={formSettings.opik_workspace || ''}
                            onChange={(e) => handleFieldChange('opik_workspace', e.target.value)}
                            className="input-text"
                            placeholder="my-workspace"
                          />
                        </div>

                        {/* Opik API Key */}
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label
                              htmlFor="opik_api_key_input"
                              style={{ fontSize: '0.85rem', fontWeight: 500 }}
                            >
                              Opik API Key
                            </label>
                            {renderSourceBadge('opik_api_key')}
                          </div>

                          {!editingOpikKey ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  color: formSettings.opik_api_key
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                {formSettings.opik_api_key || 'No Opik key configured'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingOpikKey(true)}
                                className="btn btn-secondary btn-sm"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <Unlock size={14} /> Change Key
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                id="opik_api_key_input"
                                type="password"
                                value={newOpikKey}
                                onChange={(e) => {
                                  setNewOpikKey(e.target.value);
                                  setIsDirty(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newOpikKey.trim() && !saving) {
                                    e.preventDefault();
                                    void handleSaveAll();
                                  }
                                }}
                                className="input-text"
                                placeholder="Enter Opik API Key"
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSaveAll();
                                }}
                                disabled={saving || !newOpikKey.trim()}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOpikKey(false);
                                  setNewOpikKey('');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Opik Self-Hosted URL */}
                        <div>
                          <label
                            htmlFor="opik_url_override"
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            Opik Custom URL Override (For Self-Hosted Opik)
                          </label>
                          <input
                            id="opik_url_override"
                            type="text"
                            value={formSettings.opik_url_override || ''}
                            onChange={(e) => handleFieldChange('opik_url_override', e.target.value)}
                            className="input-text"
                            placeholder="http://localhost:5173/api"
                          />
                        </div>
                      </div>
                    )}

                    {/* PROVIDER 2: LANGFUSE */}
                    {activeObservabilityProvider === 'langfuse' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            id="langfuse_enabled"
                            checked={Boolean(formSettings.langfuse_enabled)}
                            onChange={(e) =>
                              handleFieldChange('langfuse_enabled', e.target.checked)
                            }
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--accent-primary)',
                            }}
                          />
                          <label
                            htmlFor="langfuse_enabled"
                            style={{ fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
                          >
                            Enable Langfuse Tracing Callbacks
                          </label>
                        </div>

                        {/* Langfuse Host URL */}
                        <div>
                          <label
                            htmlFor="langfuse_host"
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            Langfuse Host URL
                          </label>
                          <input
                            id="langfuse_host"
                            type="text"
                            value={formSettings.langfuse_host || ''}
                            onChange={(e) => handleFieldChange('langfuse_host', e.target.value)}
                            className="input-text"
                            placeholder="https://cloud.langfuse.com (or self-hosted http://localhost:3000)"
                          />
                        </div>

                        {/* Langfuse Public Key */}
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label
                              htmlFor="langfuse_public_key_input"
                              style={{ fontSize: '0.85rem', fontWeight: 500 }}
                            >
                              Langfuse Public Key
                            </label>
                            {renderSourceBadge('langfuse_public_key')}
                          </div>

                          {!editingLangfusePubKey ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  color: formSettings.langfuse_public_key
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                {formSettings.langfuse_public_key ||
                                  'No Langfuse public key configured'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingLangfusePubKey(true)}
                                className="btn btn-secondary btn-sm"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <Unlock size={14} /> Change Key
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                id="langfuse_public_key_input"
                                type="text"
                                value={newLangfusePubKey}
                                onChange={(e) => {
                                  setNewLangfusePubKey(e.target.value);
                                  setIsDirty(true);
                                }}
                                className="input-text"
                                placeholder="pk-lf-..."
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSaveAll();
                                }}
                                disabled={saving || !newLangfusePubKey.trim()}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLangfusePubKey(false);
                                  setNewLangfusePubKey('');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Langfuse Secret Key */}
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label
                              htmlFor="langfuse_secret_key_input"
                              style={{ fontSize: '0.85rem', fontWeight: 500 }}
                            >
                              Langfuse Secret Key
                            </label>
                            {renderSourceBadge('langfuse_secret_key')}
                          </div>

                          {!editingLangfuseSecKey ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  color: formSettings.langfuse_secret_key
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                {formSettings.langfuse_secret_key ||
                                  'No Langfuse secret key configured'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingLangfuseSecKey(true)}
                                className="btn btn-secondary btn-sm"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <Unlock size={14} /> Change Key
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                id="langfuse_secret_key_input"
                                type="password"
                                value={newLangfuseSecKey}
                                onChange={(e) => {
                                  setNewLangfuseSecKey(e.target.value);
                                  setIsDirty(true);
                                }}
                                className="input-text"
                                placeholder="sk-lf-..."
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSaveAll();
                                }}
                                disabled={saving || !newLangfuseSecKey.trim()}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLangfuseSecKey(false);
                                  setNewLangfuseSecKey('');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PROVIDER 3: LANGSMITH */}
                    {activeObservabilityProvider === 'langsmith' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            id="langsmith_enabled"
                            checked={Boolean(formSettings.langsmith_enabled)}
                            onChange={(e) =>
                              handleFieldChange('langsmith_enabled', e.target.checked)
                            }
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--accent-primary)',
                            }}
                          />
                          <label
                            htmlFor="langsmith_enabled"
                            style={{ fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
                          >
                            Enable LangSmith Tracing Callbacks
                          </label>
                        </div>

                        {/* LangSmith Project Name */}
                        <div>
                          <label
                            htmlFor="langsmith_project"
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            LangSmith Project Name
                          </label>
                          <input
                            id="langsmith_project"
                            type="text"
                            value={formSettings.langsmith_project || ''}
                            onChange={(e) => handleFieldChange('langsmith_project', e.target.value)}
                            className="input-text"
                            placeholder="jobfoundry"
                          />
                        </div>

                        {/* LangSmith API Key */}
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label
                              htmlFor="langsmith_api_key_input"
                              style={{ fontSize: '0.85rem', fontWeight: 500 }}
                            >
                              LangSmith API Key
                            </label>
                            {renderSourceBadge('langsmith_api_key')}
                          </div>

                          {!editingLangsmithKey ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  color: formSettings.langsmith_api_key
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                                {formSettings.langsmith_api_key || 'No LangSmith key configured'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingLangsmithKey(true)}
                                className="btn btn-secondary btn-sm"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <Unlock size={14} /> Change Key
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                id="langsmith_api_key_input"
                                type="password"
                                value={newLangsmithKey}
                                onChange={(e) => {
                                  setNewLangsmithKey(e.target.value);
                                  setIsDirty(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newLangsmithKey.trim() && !saving) {
                                    e.preventDefault();
                                    void handleSaveAll();
                                  }
                                }}
                                className="input-text"
                                placeholder="lsv2_pt_..."
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSaveAll();
                                }}
                                disabled={saving || !newLangsmithKey.trim()}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLangsmithKey(false);
                                  setNewLangsmithKey('');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* LangSmith Endpoint */}
                        <div>
                          <label
                            htmlFor="langsmith_endpoint"
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            LangSmith Endpoint URL
                          </label>
                          <input
                            id="langsmith_endpoint"
                            type="text"
                            value={formSettings.langsmith_endpoint || ''}
                            onChange={(e) =>
                              handleFieldChange('langsmith_endpoint', e.target.value)
                            }
                            className="input-text"
                            placeholder="https://api.smith.langchain.com"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: SCRAPERS & SEARCH FILTERS */}
              {activeTab === 'scrapers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <ScraperSettingsTab
                    config={extensionConfig}
                    onChange={handleExtensionChange}
                    onSave={handleSaveExtensionConfig}
                    saving={savingScrapers}
                    onExtractFromResume={handleExtractFromResume}
                    extractingResume={extractingResume}
                  />
                  {/* Next / Previous Step Footer Navigation */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0 1rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTabChange('profile')}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ArrowLeft size={15} /> Back to Master Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('sync')}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.4rem',
                      }}
                    >
                      Next: Extension Pairing & Sync <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: EXTENSION & AUTH */}
              {activeTab === 'sync' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <ExtensionSyncView
                    onPairingChange={() => {
                      setIsExtensionPaired(
                        typeof window !== 'undefined' &&
                          localStorage.getItem('jf_extension_paired') === 'true'
                      );
                    }}
                  />
                  {/* Previous Step Footer Navigation */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      padding: '0.5rem 0 1rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTabChange('scrapers')}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ArrowLeft size={15} /> Back to Search Filters & Scrapers
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: TELEMETRY & SYSTEM */}
              {activeTab === 'system' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <RegistrationControls />

                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        marginBottom: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Download size={18} style={{ color: 'var(--accent-primary)' }} />
                      Data Export
                    </h3>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Your career data belongs to you. Download portable copies generated from your
                      local database and artifacts — no platform lock-in.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleExport('json-resume')}
                        disabled={exportingFormat !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                      >
                        {exportingFormat === 'json-resume' && !exportingJobId ? (
                          <RefreshCw size={16} className="spin" />
                        ) : (
                          <FileJson size={16} />
                        )}
                        JSON Resume
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleExport('csv')}
                        disabled={exportingFormat !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                      >
                        {exportingFormat === 'csv' ? (
                          <RefreshCw size={16} className="spin" />
                        ) : (
                          <FileSpreadsheet size={16} />
                        )}
                        Job History CSV
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleExport('archive')}
                        disabled={exportingFormat !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                      >
                        {exportingFormat === 'archive' ? (
                          <RefreshCw size={16} className="spin" />
                        ) : (
                          <Archive size={16} />
                        )}
                        Full Archive (.zip)
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.9rem',
                      }}
                    >
                      <select
                        className="input-text"
                        aria-label="Tailored resume to export"
                        value={selectedTailoredJobId}
                        onChange={(e) => setSelectedTailoredJobId(e.target.value)}
                        disabled={loadingTailoredJobs || tailoredJobs.length === 0}
                        style={{ maxWidth: '22rem' }}
                      >
                        {tailoredJobs.length === 0 ? (
                          <option value="">
                            {loadingTailoredJobs
                              ? 'Loading tailored resumes...'
                              : tailoredJobsError
                                ? 'Could not load tailored resumes'
                                : 'No tailored resumes yet'}
                          </option>
                        ) : (
                          tailoredJobs.map((job) => (
                            <option key={job.id} value={job.id}>
                              {job.label}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleExport('json-resume', selectedTailoredJobId)}
                        disabled={!selectedTailoredJobId || exportingFormat !== null}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                      >
                        {exportingJobId === selectedTailoredJobId ? (
                          <RefreshCw size={16} className="spin" />
                        ) : (
                          <FileJson size={16} />
                        )}
                        Tailored variant
                      </button>
                      {tailoredJobsError && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setTailoredJobsReloadKey((key) => key + 1)}
                          disabled={loadingTailoredJobs}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                        >
                          <RefreshCw size={16} />
                          Retry
                        </button>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        margin: '0.9rem 0 0',
                      }}
                    >
                      JSON Resume exports your active master profile (v1.0.0), and the selector
                      downloads a job-tailored variant. The CSV covers your full job search history.
                      The archive bundles database records, tailored resumes, and generated PDFs.
                    </p>
                  </div>

                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        marginBottom: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Database size={18} style={{ color: 'var(--accent-primary)' }} />
                      System Diagnostics & Architecture
                    </h3>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Live operational metrics from the running container services.
                    </p>

                    {diagnostics ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '1rem',
                          marginBottom: '1.5rem',
                        }}
                      >
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-secondary)',
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Status
                          </div>
                          <div
                            style={{
                              fontSize: '1.2rem',
                              fontWeight: 700,
                              color: 'var(--color-green)',
                            }}
                          >
                            ● {diagnostics.status}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-secondary)',
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Server Uptime
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                            {Math.floor(diagnostics.uptime / 60)}m{' '}
                            {Math.floor(diagnostics.uptime % 60)}s
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-secondary)',
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Total Jobs in DB
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                            {diagnostics.database.totalJobs}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-secondary)',
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Node Environment
                          </div>
                          <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                            {diagnostics.environment.nodeVersion} (
                            {diagnostics.environment.platform})
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Diagnostics unavailable.
                      </div>
                    )}

                    {/* Storage & Volume Paths */}
                    <div
                      style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}
                    >
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Container Storage Mounts & Fallbacks
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            SQLite Database Path:
                          </span>
                          <code>/data/jobfoundry.db</code>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Artifacts Storage Path:
                          </span>
                          <code>/data/artifacts</code>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            LLM provider endpoint:
                          </span>
                          <code>{formSettings.scorer_api_base || 'Not configured'}</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Sticky Save Bar when settings are modified */}
      {isDirty && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '2rem',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-full)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              fontSize: '0.82rem',
              color: 'var(--color-warning, #f59e0b)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ● Unsaved Settings
          </span>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="btn btn-secondary btn-sm"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="btn btn-primary btn-sm"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};
