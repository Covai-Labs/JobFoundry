import React, { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../../lib/auth';
import {
  api,
  SystemSettings,
  SettingMeta,
  DiagnosticsInfo,
  ExtensionConfig,
  PromptTemplateDefaults,
} from '../../api/client';
import { useTheme, ACCENT_THEMES, ColorMode, AccentTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { ScraperSettingsTab } from './ScraperSettingsTab';
import { ResumeManager } from '../resume/ResumeManager';
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
} from 'lucide-react';
import { LLM_PROVIDERS, detectProviderFromModel, ALL_RECOMMENDED_MODELS } from './llmCatalog';

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

  // System settings state
  const [formSettings, setFormSettings] = useState<SystemSettings>({
    default_llm_model: 'openrouter/openrouter/free',
    default_llm_provider: 'openrouter',
    default_llm_api_key: '',
    default_llm_api_base: '',
    scorer_inherit_default: true,
    tailor_inherit_default: true,
    copilot_inherit_default: true,
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
    tailor_timeout_seconds: 900,
    copilot_inherit_model: true,
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
    opik_enabled: false,
    opik_project_name: 'jobfoundry',
    opik_api_key: '',
    opik_workspace: '',
    opik_url_override: '',
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

  // Default Gateway State
  const [selectedDefaultProvider, setSelectedDefaultProvider] = useState<string>(() => {
    return (
      formSettings.default_llm_provider ||
      detectProviderFromModel(formSettings.default_llm_model || '') ||
      'openrouter'
    );
  });
  const [showDefaultEndpointOverride, setShowDefaultEndpointOverride] = useState<boolean>(false);
  const [testingDefaultLlm, setTestingDefaultLlm] = useState(false);
  const [defaultTestResult, setDefaultTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
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
  const [showScorerEndpointOverride, setShowScorerEndpointOverride] = useState<boolean>(false);

  const [selectedTailorProvider, setSelectedTailorProvider] = useState<string>(() => {
    return (
      formSettings.tailor_provider ||
      detectProviderFromModel(formSettings.tailor_model) ||
      'openrouter'
    );
  });
  const [showTailorEndpointOverride, setShowTailorEndpointOverride] = useState<boolean>(false);

  // Copilot Settings State
  const [editingCopilotKey, setEditingCopilotKey] = useState(false);
  const [newCopilotKey, setNewCopilotKey] = useState('');
  const [selectedCopilotProvider, setSelectedCopilotProvider] = useState<string>('openrouter');
  const [showCopilotEndpointOverride, setShowCopilotEndpointOverride] = useState<boolean>(false);
  const [testingCopilotLlm, setTestingCopilotLlm] = useState(false);
  const [copilotTestResult, setCopilotTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
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
  } | null>(null);

  const [testingTailorLlm, setTestingTailorLlm] = useState(false);
  const [tailorTestResult, setTailorTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [hasActiveResume, setHasActiveResume] = useState(false);

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
          if (backendSettings.default_llm_api_base) {
            setShowDefaultEndpointOverride(true);
          }

          if (backendSettings.scorer_provider) {
            setSelectedScorerProvider(backendSettings.scorer_provider);
          } else if (backendSettings.scorer_model) {
            setSelectedScorerProvider(detectProviderFromModel(backendSettings.scorer_model));
          }
          if (backendSettings.scorer_api_base) {
            setShowScorerEndpointOverride(true);
          }
          if (backendSettings.tailor_provider) {
            setSelectedTailorProvider(backendSettings.tailor_provider);
          } else if (backendSettings.tailor_model) {
            setSelectedTailorProvider(detectProviderFromModel(backendSettings.tailor_model));
          }
          if (backendSettings.tailor_api_base) {
            setShowTailorEndpointOverride(true);
          }
          if (backendSettings.copilot_provider) {
            setSelectedCopilotProvider(backendSettings.copilot_provider);
          } else if (backendSettings.copilot_model) {
            setSelectedCopilotProvider(detectProviderFromModel(backendSettings.copilot_model));
          }
          if (backendSettings.copilot_api_base) {
            setShowCopilotEndpointOverride(true);
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

  const handleSelectDefaultProvider = (providerId: string) => {
    setSelectedDefaultProvider(providerId);
    handleFieldChange('default_llm_provider', providerId);
    const providerMeta = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (providerMeta?.isLocal || providerMeta?.isCustom) {
      setShowDefaultEndpointOverride(true);
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
      setShowScorerEndpointOverride(true);
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
      setShowTailorEndpointOverride(true);
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
      setShowCopilotEndpointOverride(true);
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
      tailor_inherit_default: true,
      copilot_inherit_default: true,
      scorer_model: 'openrouter/openrouter/free',
      scorer_threshold: 75,
      tailor_model: 'openrouter/openrouter/free',
      tailor_theme: 'jsonresume-theme-folio',
      tailor_timeout_seconds: 900,
      opik_enabled: false,
    }));
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
        const apiBase = formSettings.default_llm_api_base;
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
        setDefaultTestResult({ success: false, error: msg });
        toast.error(msg);
      } finally {
        setTestingDefaultLlm(false);
      }
    } else if (service === 'scorer') {
      setTestingLlm(true);
      setTestResult(null);
      try {
        const isInherited = formSettings.scorer_inherit_default !== false;
        const model = isInherited
          ? formSettings.default_llm_model || 'openrouter/openrouter/free'
          : formSettings.scorer_model;
        const apiBase = isInherited
          ? formSettings.default_llm_api_base
          : formSettings.scorer_api_base;
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
        setTestResult({ success: false, error: msg });
        toast.error(msg);
      } finally {
        setTestingLlm(false);
      }
    } else if (service === 'tailor') {
      setTestingTailorLlm(true);
      setTailorTestResult(null);
      try {
        const isInherited = formSettings.tailor_inherit_default !== false;
        const model = isInherited
          ? formSettings.default_llm_model || 'openrouter/openrouter/free'
          : formSettings.tailor_model;
        const apiBase = isInherited
          ? formSettings.default_llm_api_base
          : formSettings.tailor_api_base;
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
        setTailorTestResult({ success: false, error: msg });
        toast.error(msg);
      } finally {
        setTestingTailorLlm(false);
      }
    } else if (service === 'copilot') {
      setTestingCopilotLlm(true);
      setCopilotTestResult(null);
      try {
        const isInherited = formSettings.copilot_inherit_default !== false;
        const model = isInherited
          ? formSettings.default_llm_model || 'openrouter/openrouter/free'
          : formSettings.copilot_model;
        const apiBase = isInherited
          ? formSettings.default_llm_api_base
          : formSettings.copilot_api_base;
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
        setCopilotTestResult({ success: false, error: msg });
        toast.error(msg);
      } finally {
        setTestingCopilotLlm(false);
      }
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
          Object.values(extensionConfig.portals || {}).some(Boolean)
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
            complete: false,
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
              <Activity size={16} /> Observability (Opik)
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
            <form onSubmit={handleSaveAll}>
              {/* TAB 0: MASTER PROFILE */}
              {activeTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="settings-card" style={{ padding: '1.5rem' }}>
                    <ResumeManager />
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
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          marginBottom: '0.5rem',
                        }}
                      >
                        Primary LLM Provider
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {LLM_PROVIDERS.map((p) => {
                          const isSelected = selectedDefaultProvider === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectDefaultProvider(p.id)}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.82rem',
                                fontWeight: isSelected ? 600 : 400,
                                border: isSelected
                                  ? '1.5px solid var(--accent-primary)'
                                  : '1px solid var(--border-subtle)',
                                background: isSelected
                                  ? 'rgba(99, 102, 241, 0.12)'
                                  : 'var(--bg-card)',
                                color: isSelected
                                  ? 'var(--accent-primary)'
                                  : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {p.isLocal && (
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>🏠</span>
                              )}
                              {p.name}
                              {isSelected && <Check size={13} style={{ strokeWidth: 3 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recommended Models */}
                    {(() => {
                      const providerMeta =
                        LLM_PROVIDERS.find((p) => p.id === selectedDefaultProvider) ||
                        LLM_PROVIDERS[0];
                      const recommended = providerMeta.recommendedModels;
                      const isFallback = recommended.length === 0;
                      const modelsToShow = !isFallback
                        ? recommended
                        : LLM_PROVIDERS.flatMap((p) => p.recommendedModels).slice(0, 5);

                      return (
                        <div
                          style={{
                            marginBottom: '1.25rem',
                            padding: '0.75rem',
                            background: 'var(--bg-input, rgba(255,255,255,0.02))',
                            border: '1px dashed var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                            Recommended Models ({providerMeta.name}):
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {modelsToShow.map((m) => {
                              const isCurrent = formSettings.default_llm_model === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    handleFieldChange('default_llm_model', m.id);
                                    setIsDirty(true);
                                  }}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.78rem',
                                    border: isCurrent
                                      ? '1px solid var(--accent-primary)'
                                      : '1px solid var(--border-subtle)',
                                    background: isCurrent
                                      ? 'rgba(99, 102, 241, 0.15)'
                                      : 'var(--bg-card)',
                                    color: isCurrent
                                      ? 'var(--accent-primary)'
                                      : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                  title={m.description}
                                >
                                  <span>{m.name}</span>
                                  <span
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '3px',
                                      background: isCurrent
                                        ? 'var(--accent-primary)'
                                        : 'var(--border-subtle)',
                                      color: isCurrent ? '#fff' : 'var(--text-muted)',
                                    }}
                                  >
                                    {m.tier}
                                  </span>
                                  {isCurrent && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Default Model ID input */}
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
                          Default Model Identifier (e.g. openrouter/model or openai/model)
                        </label>
                      </div>
                      <input
                        type="text"
                        list="default-model-suggestions"
                        value={formSettings.default_llm_model || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleFieldChange('default_llm_model', val);
                          const detected = detectProviderFromModel(val);
                          if (detected && detected !== selectedDefaultProvider) {
                            setSelectedDefaultProvider(detected);
                            handleFieldChange('default_llm_provider', detected);
                          }
                        }}
                        className="input-text"
                        placeholder="openrouter/openrouter/free"
                        required
                      />
                      <datalist id="default-model-suggestions">
                        {ALL_RECOMMENDED_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.provider}) - {m.description}
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
                        This model is used across AI Fit Scorer, Resume Tailoring, and Copilot by
                        default.
                      </span>
                    </div>

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

                    {/* Custom Endpoint Base URL / Proxy */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      {!showDefaultEndpointOverride ? (
                        <button
                          type="button"
                          onClick={() => setShowDefaultEndpointOverride(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <ChevronRight size={14} /> Advanced: Custom Endpoint Base URL / Proxy
                        </button>
                      ) : (
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-input)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                              Custom Endpoint Base URL
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setShowDefaultEndpointOverride(false);
                                handleFieldChange('default_llm_api_base', '');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              Reset / Hide
                            </button>
                          </div>
                          <input
                            type="url"
                            value={formSettings.default_llm_api_base || ''}
                            onChange={(e) =>
                              handleFieldChange('default_llm_api_base', e.target.value)
                            }
                            className="input-text"
                            placeholder="https://openrouter.ai/api/v1"
                          />
                        </div>
                      )}
                    </div>

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
                            {defaultTestResult.message || defaultTestResult.error}
                            {defaultTestResult.latencyMs !== undefined
                              ? ` (${defaultTestResult.latencyMs}ms)`
                              : ''}
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
                      <div
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
                          AI Fit Scorer
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color:
                              formSettings.scorer_inherit_default !== false
                                ? 'var(--color-success, #10b981)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {formSettings.scorer_inherit_default !== false
                            ? '✓ Inheriting from Gateway'
                            : 'Using Custom Override'}
                        </div>
                      </div>
                      <div
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
                          Resume Tailor
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color:
                              formSettings.tailor_inherit_default !== false
                                ? 'var(--color-success, #10b981)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {formSettings.tailor_inherit_default !== false
                            ? '✓ Inheriting from Gateway'
                            : 'Using Custom Override'}
                        </div>
                      </div>
                      <div
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
                          Copilot & Prompts
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color:
                              formSettings.copilot_inherit_default !== false
                                ? 'var(--color-success, #10b981)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {formSettings.copilot_inherit_default !== false
                            ? '✓ Inheriting from Gateway'
                            : 'Using Custom Override'}
                        </div>
                      </div>
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
                            <Activity size={14} /> Open Opik Observability Tab
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
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background:
                          formSettings.scorer_inherit_default !== false
                            ? 'rgba(99, 102, 241, 0.08)'
                            : 'var(--bg-input)',
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
                          checked={formSettings.scorer_inherit_default !== false}
                          onChange={(e) => {
                            handleFieldChange('scorer_inherit_default', e.target.checked);
                            setIsDirty(true);
                          }}
                          style={{
                            accentColor: 'var(--accent-primary)',
                            width: '16px',
                            height: '16px',
                          }}
                        />
                        Inherit model & provider from Default AI Gateway (Recommended)
                      </label>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.35rem',
                          marginLeft: '1.65rem',
                        }}
                      >
                        {formSettings.scorer_inherit_default !== false
                          ? `Currently using ${formSettings.default_llm_model || 'openrouter/openrouter/free'} with inherited gateway credentials.`
                          : 'Configure a dedicated, independent LLM model and credentials specifically for job fit scoring.'}
                      </div>
                    </div>

                    {formSettings.scorer_inherit_default === false && (
                      <>
                        {/* Primary Provider Selector */}
                        <div style={{ marginBottom: '1.25rem' }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              marginBottom: '0.5rem',
                            }}
                          >
                            Primary LLM Provider
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {LLM_PROVIDERS.map((p) => {
                              const isSelected = selectedScorerProvider === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectScorerProvider(p.id)}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.82rem',
                                    fontWeight: isSelected ? 600 : 400,
                                    border: isSelected
                                      ? '1.5px solid var(--accent-primary)'
                                      : '1px solid var(--border-subtle)',
                                    background: isSelected
                                      ? 'rgba(99, 102, 241, 0.12)'
                                      : 'var(--bg-card)',
                                    color: isSelected
                                      ? 'var(--accent-primary)'
                                      : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {p.isLocal && (
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>🏠</span>
                                  )}
                                  {p.name}
                                  {isSelected && <Check size={13} style={{ strokeWidth: 3 }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Recommended Fast Models */}
                        {(() => {
                          const providerMeta =
                            LLM_PROVIDERS.find((p) => p.id === selectedScorerProvider) ||
                            LLM_PROVIDERS[0];
                          const fastModels = providerMeta.recommendedModels.filter(
                            (m) => m.tier === 'fast'
                          );
                          const isFallback = fastModels.length === 0;
                          const modelsToShow = !isFallback
                            ? fastModels
                            : LLM_PROVIDERS.flatMap((p) => p.recommendedModels)
                                .filter((m) => m.tier === 'fast')
                                .slice(0, 4);

                          return (
                            <div
                              style={{
                                marginBottom: '1.25rem',
                                padding: '0.75rem',
                                background: 'var(--bg-input, rgba(255,255,255,0.02))',
                                border: '1px dashed var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                                {isFallback
                                  ? 'Recommended Fast Screening Models (other providers):'
                                  : `Recommended Fast Screening Models (${providerMeta.name}):`}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {modelsToShow.map((m) => {
                                  const isCurrent = formSettings.scorer_model === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        handleFieldChange('scorer_model', m.id);
                                        setIsDirty(true);
                                      }}
                                      style={{
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.78rem',
                                        border: isCurrent
                                          ? '1px solid var(--accent-primary)'
                                          : '1px solid var(--border-subtle)',
                                        background: isCurrent
                                          ? 'rgba(99, 102, 241, 0.15)'
                                          : 'var(--bg-card)',
                                        color: isCurrent
                                          ? 'var(--accent-primary)'
                                          : 'var(--text-primary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                      }}
                                      title={m.description}
                                    >
                                      <span>{m.name}</span>
                                      <span
                                        style={{
                                          fontSize: '0.7rem',
                                          padding: '0.1rem 0.35rem',
                                          borderRadius: '3px',
                                          background: isCurrent
                                            ? 'var(--accent-primary)'
                                            : 'var(--border-subtle)',
                                          color: isCurrent ? '#fff' : 'var(--text-muted)',
                                        }}
                                      >
                                        Fast
                                      </span>
                                      {isCurrent && <Check size={12} />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Model ID input + datalist */}
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
                              Scorer Model Identifier (e.g. openrouter/model or openai/model)
                            </label>
                          </div>
                          <input
                            type="text"
                            list="scorer-model-suggestions"
                            value={formSettings.scorer_model}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleFieldChange('scorer_model', val);
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
                            className="input-text"
                            placeholder="openrouter/z-ai/glm-5.3-flash"
                            required
                          />
                          <datalist id="scorer-model-suggestions">
                            {ALL_RECOMMENDED_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.provider}) - {m.description}
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
                            LiteLLM supports 2,500+ models. Select from quick recommendations or
                            type any valid model identifier.
                          </span>
                        </div>

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

                        {/* Endpoint Base URL (Smart Toggle / Override) */}
                        {(() => {
                          const p = LLM_PROVIDERS.find((x) => x.id === selectedScorerProvider);
                          const requiresBaseUrl = Boolean(p?.isLocal || p?.isCustom);
                          const isShowing =
                            requiresBaseUrl ||
                            showScorerEndpointOverride ||
                            Boolean(formSettings.scorer_api_base);

                          if (isShowing) {
                            return (
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
                                    LLM Endpoint Base URL{' '}
                                    {requiresBaseUrl ? '' : '(Custom Override)'}
                                  </label>
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                  >
                                    {!requiresBaseUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowScorerEndpointOverride(false);
                                          handleFieldChange('scorer_api_base', '');
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: 'var(--text-muted)',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                        }}
                                      >
                                        Reset to Default Route
                                      </button>
                                    )}
                                    {renderSourceBadge('scorer_api_base')}
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={formSettings.scorer_api_base}
                                  onChange={(e) =>
                                    handleFieldChange('scorer_api_base', e.target.value)
                                  }
                                  className="input-text"
                                  placeholder={p?.defaultBase || 'https://openrouter.ai/api/v1'}
                                />
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '0.25rem',
                                    display: 'block',
                                  }}
                                >
                                  {requiresBaseUrl
                                    ? 'Local/Gateway endpoints (e.g. http://localhost:11434 for Ollama).'
                                    : 'Cloud providers route automatically; custom base URL is only needed for private reverse proxies or gateways.'}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div style={{ marginBottom: '1.5rem' }}>
                              <button
                                type="button"
                                onClick={() => setShowScorerEndpointOverride(true)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-primary)',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.2rem 0',
                                }}
                              >
                                <ChevronRight size={14} /> Advanced: Custom Endpoint Base URL /
                                Proxy
                              </button>
                            </div>
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
                              ? 'inherited gateway credentials'
                              : 'custom scorer credentials'}
                            .
                          </div>
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
                            {testResult.message || testResult.error}
                            {testResult.latencyMs !== undefined
                              ? ` (${testResult.latencyMs}ms)`
                              : ''}
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
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background:
                          formSettings.tailor_inherit_default !== false
                            ? 'rgba(99, 102, 241, 0.08)'
                            : 'var(--bg-input)',
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
                          checked={formSettings.tailor_inherit_default !== false}
                          onChange={(e) => {
                            handleFieldChange('tailor_inherit_default', e.target.checked);
                            setIsDirty(true);
                          }}
                          style={{
                            accentColor: 'var(--accent-primary)',
                            width: '16px',
                            height: '16px',
                          }}
                        />
                        Inherit model & provider from Default AI Gateway (Recommended)
                      </label>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.35rem',
                          marginLeft: '1.65rem',
                        }}
                      >
                        {formSettings.tailor_inherit_default !== false
                          ? `Currently using ${formSettings.default_llm_model || 'openrouter/openrouter/free'} with inherited gateway credentials.`
                          : 'Configure independent provider credentials and dedicated model specifically for high-capacity resume tailoring.'}
                      </div>
                    </div>

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
                          <div style={{ marginBottom: '1rem' }}>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                              }}
                            >
                              Tailor Dedicated Provider
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {LLM_PROVIDERS.map((p) => {
                                const isSelected = selectedTailorProvider === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelectTailorProvider(p.id)}
                                    style={{
                                      padding: '0.35rem 0.65rem',
                                      borderRadius: 'var(--radius-md)',
                                      fontSize: '0.8rem',
                                      fontWeight: isSelected ? 600 : 400,
                                      border: isSelected
                                        ? '1.5px solid var(--accent-primary)'
                                        : '1px solid var(--border-subtle)',
                                      background: isSelected
                                        ? 'rgba(99, 102, 241, 0.12)'
                                        : 'var(--bg-card)',
                                      color: isSelected
                                        ? 'var(--accent-primary)'
                                        : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                    }}
                                  >
                                    {p.name}
                                    {isSelected && <Check size={12} />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

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

                          {/* Tailor Base URL */}
                          {(() => {
                            const p = LLM_PROVIDERS.find((x) => x.id === selectedTailorProvider);
                            const requiresBase = Boolean(p?.isLocal || p?.isCustom);
                            if (
                              requiresBase ||
                              showTailorEndpointOverride ||
                              Boolean(formSettings.tailor_api_base)
                            ) {
                              return (
                                <div>
                                  <label
                                    style={{
                                      fontSize: '0.85rem',
                                      fontWeight: 500,
                                      display: 'block',
                                      marginBottom: '0.35rem',
                                    }}
                                  >
                                    Dedicated Endpoint Base URL
                                  </label>
                                  <input
                                    type="text"
                                    value={formSettings.tailor_api_base}
                                    onChange={(e) =>
                                      handleFieldChange('tailor_api_base', e.target.value)
                                    }
                                    className="input-text"
                                    placeholder={p?.defaultBase || 'https://api.openai.com/v1'}
                                  />
                                </div>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => setShowTailorEndpointOverride(true)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-primary)',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <ChevronRight size={14} /> Custom Tailor Base URL (Optional)
                              </button>
                            );
                          })()}
                        </div>

                        {/* Recommended Tailoring & Reasoning Models */}
                        {(() => {
                          const effectiveProvider = selectedTailorProvider;
                          const providerMeta = LLM_PROVIDERS.find(
                            (p) => p.id === effectiveProvider
                          );
                          const reasoningModels =
                            providerMeta?.recommendedModels.filter((m) => m.tier === 'reasoning') ||
                            [];
                          const isFallback = reasoningModels.length === 0;
                          const modelsToShow = !isFallback
                            ? reasoningModels
                            : LLM_PROVIDERS.flatMap((p) => p.recommendedModels)
                                .filter((m) => m.tier === 'reasoning')
                                .slice(0, 5);

                          return (
                            <div
                              style={{
                                marginBottom: '1.25rem',
                                padding: '0.75rem',
                                background: 'var(--bg-input, rgba(255,255,255,0.02))',
                                border: '1px dashed var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                                {isFallback
                                  ? 'Recommended Tailoring & Deep Reasoning Models (other providers):'
                                  : `Recommended Tailoring & Deep Reasoning Models (${providerMeta?.name || 'Selected Provider'}):`}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {modelsToShow.map((m) => {
                                  const isCurrent = formSettings.tailor_model === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        handleFieldChange('tailor_model', m.id);
                                        setIsDirty(true);
                                      }}
                                      style={{
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.78rem',
                                        border: isCurrent
                                          ? '1px solid var(--accent-primary)'
                                          : '1px solid var(--border-subtle)',
                                        background: isCurrent
                                          ? 'rgba(99, 102, 241, 0.15)'
                                          : 'var(--bg-card)',
                                        color: isCurrent
                                          ? 'var(--accent-primary)'
                                          : 'var(--text-primary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                      }}
                                      title={m.description}
                                    >
                                      <span>{m.name}</span>
                                      <span
                                        style={{
                                          fontSize: '0.7rem',
                                          padding: '0.1rem 0.35rem',
                                          borderRadius: '3px',
                                          background: isCurrent
                                            ? 'var(--accent-primary)'
                                            : 'var(--border-subtle)',
                                          color: isCurrent ? '#fff' : 'var(--text-muted)',
                                        }}
                                      >
                                        Reasoning
                                      </span>
                                      {isCurrent && <Check size={12} />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Tailor Model input */}
                        <div style={{ marginBottom: '1.25rem' }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            Tailoring Model Identifier
                          </label>
                          <input
                            type="text"
                            list="tailor-model-suggestions"
                            value={formSettings.tailor_model}
                            onChange={(e) => handleFieldChange('tailor_model', e.target.value)}
                            className="input-text"
                            placeholder="openrouter/deepseek/deepseek-v4.1-pro"
                          />
                          <datalist id="tailor-model-suggestions">
                            {ALL_RECOMMENDED_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.provider}) - {m.description}
                              </option>
                            ))}
                          </datalist>
                        </div>
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
                        <option value="jsonresume-theme-folio">Folio (One single page pdf)</option>
                        <option value="jsonresume-theme-stackoverflow">
                          StackOverflow (Clean Developer Theme)
                        </option>
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
                              ? 'inherited gateway credentials'
                              : 'custom tailor credentials'}
                            .
                          </div>
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
                            {tailorTestResult.message || tailorTestResult.error}
                            {tailorTestResult.latencyMs !== undefined
                              ? ` (${tailorTestResult.latencyMs}ms)`
                              : ''}
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
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background:
                          formSettings.copilot_inherit_default !== false
                            ? 'rgba(99, 102, 241, 0.08)'
                            : 'var(--bg-input)',
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
                          checked={formSettings.copilot_inherit_default !== false}
                          onChange={(e) => {
                            handleFieldChange('copilot_inherit_default', e.target.checked);
                            setIsDirty(true);
                          }}
                          style={{
                            accentColor: 'var(--accent-primary)',
                            width: '16px',
                            height: '16px',
                          }}
                        />
                        Inherit model & provider from Default AI Gateway (Recommended)
                      </label>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.35rem',
                          marginLeft: '1.65rem',
                        }}
                      >
                        {formSettings.copilot_inherit_default !== false
                          ? `Currently using ${formSettings.default_llm_model || 'openrouter/openrouter/free'} with inherited gateway credentials.`
                          : 'Configure a dedicated, independent LLM provider and credentials specifically for Copilot drafts.'}
                      </div>
                    </div>

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
                        <div style={{ marginBottom: '1rem' }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              marginBottom: '0.5rem',
                            }}
                          >
                            Copilot Dedicated Provider
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {LLM_PROVIDERS.map((p) => {
                              const isSelected = selectedCopilotProvider === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectCopilotProvider(p.id)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.8rem',
                                    fontWeight: isSelected ? 600 : 400,
                                    border: isSelected
                                      ? '1.5px solid var(--accent-primary)'
                                      : '1px solid var(--border-subtle)',
                                    background: isSelected
                                      ? 'rgba(99, 102, 241, 0.12)'
                                      : 'var(--bg-card)',
                                    color: isSelected
                                      ? 'var(--accent-primary)'
                                      : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  {p.name}
                                  {isSelected && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

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

                        {/* Copilot Model Identifier */}
                        <div style={{ marginBottom: '1rem' }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              marginBottom: '0.35rem',
                            }}
                          >
                            Copilot Model Identifier
                          </label>
                          <input
                            type="text"
                            list="copilot-model-suggestions"
                            value={formSettings.copilot_model || ''}
                            onChange={(e) => handleFieldChange('copilot_model', e.target.value)}
                            className="input-text"
                            placeholder="openrouter/anthropic/claude-3.5-sonnet"
                          />
                          <datalist id="copilot-model-suggestions">
                            {ALL_RECOMMENDED_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.provider})
                              </option>
                            ))}
                          </datalist>
                        </div>

                        {/* Copilot Base URL */}
                        {(() => {
                          const p = LLM_PROVIDERS.find((x) => x.id === selectedCopilotProvider);
                          const requiresBase = Boolean(p?.isLocal || p?.isCustom);
                          if (
                            requiresBase ||
                            showCopilotEndpointOverride ||
                            Boolean(formSettings.copilot_api_base)
                          ) {
                            return (
                              <div>
                                <label
                                  style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    display: 'block',
                                    marginBottom: '0.35rem',
                                  }}
                                >
                                  Copilot Endpoint Base URL
                                </label>
                                <input
                                  type="text"
                                  value={formSettings.copilot_api_base || ''}
                                  onChange={(e) =>
                                    handleFieldChange('copilot_api_base', e.target.value)
                                  }
                                  className="input-text"
                                  placeholder={p?.defaultBase || 'https://api.openai.com/v1'}
                                />
                              </div>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => setShowCopilotEndpointOverride(true)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <ChevronRight size={14} /> Custom Endpoint Base URL (Optional)
                            </button>
                          );
                        })()}
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
                            ? 'inherited gateway credentials'
                            : 'custom copilot credentials'}
                          .
                        </div>
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
                          {copilotTestResult.message || copilotTestResult.error}
                          {copilotTestResult.latencyMs !== undefined
                            ? ` (${copilotTestResult.latencyMs}ms)`
                            : ''}
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
                        LLM Observability & Opik Tracing
                      </h3>
                      {renderSourceBadge('opik_project_name')}
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      Stream prompt tokens, model latency, and evaluation traces to Comet Opik Cloud
                      or your self-hosted Opik instance.
                    </p>

                    {/* Opik Enabled Toggle */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1.25rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        id="opik_enabled"
                        checked={formSettings.opik_enabled}
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
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label
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
                        type="text"
                        value={formSettings.opik_project_name}
                        onChange={(e) => handleFieldChange('opik_project_name', e.target.value)}
                        className="input-text"
                        placeholder="jobfoundry"
                      />
                    </div>

                    {/* Opik Workspace */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label
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
                        type="text"
                        value={formSettings.opik_workspace}
                        onChange={(e) => handleFieldChange('opik_workspace', e.target.value)}
                        className="input-text"
                        placeholder="my-workspace"
                      />
                    </div>

                    {/* Opik API Key */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Opik API Key</label>
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
                            type="password"
                            value={newOpikKey}
                            onChange={(e) => {
                              setNewOpikKey(e.target.value);
                              setIsDirty(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newOpikKey.trim() && !saving) {
                                e.preventDefault();
                                handleSaveAll();
                              }
                            }}
                            className="input-text"
                            placeholder="Enter Opik API Key"
                            style={{ flex: 1 }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAll()}
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
                        type="text"
                        value={formSettings.opik_url_override}
                        onChange={(e) => handleFieldChange('opik_url_override', e.target.value)}
                        className="input-text"
                        placeholder="http://localhost:5173/api"
                      />
                    </div>
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
                  <ExtensionSyncView />
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
