import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ToastProvider } from '../../../context/ToastContext';
import { AuthProvider } from '../../../context/AuthContext';
import { api } from '../../../api/client';

const mockSettings = {
  apiKey: 'test-key',
  apiUrl: 'http://localhost:8080',
  threshold: 75,
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(api, 'getSettings').mockResolvedValue({
      settings: {
        default_llm_provider: 'openrouter',
        default_llm_model: 'openrouter/google/gemini-2.0-flash-exp:free',
        default_llm_api_key: 'sk-or-••••••••0d60',
        default_llm_api_base: '',
        scorer_inherit_default: false,
        scorer_model: 'openrouter/google/gemini-2.0-flash-exp:free',
        scorer_provider: 'openrouter',
        scorer_api_key: 'sk-or-••••••••0d60',
        scorer_api_base: '',
        scorer_threshold: 75,
        worker_enabled: true,
        worker_poll_interval_seconds: 10,
        tailor_inherit_default: true,
        tailor_model: 'openrouter/google/gemini-2.0-flash-exp:free',
        tailor_api_key: '',
        tailor_api_base: '',
        tailor_theme: 'jsonresume-theme-folio',
        tailor_timeout_seconds: 900,
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
        theme_color_mode: 'system',
        theme_accent: 'indigo',
      },
      meta: {
        default_llm_model: {
          source: 'default',
          hasCustomKey: true,
          updatedAt: null,
          type: 'string',
          secret: false,
        },
        default_llm_api_key: {
          source: 'system',
          hasCustomKey: true,
          updatedAt: 12345,
          type: 'string',
          secret: true,
        },
        scorer_model: {
          source: 'default',
          hasCustomKey: true,
          updatedAt: null,
          type: 'string',
          secret: false,
        },
        scorer_threshold: {
          source: 'default',
          hasCustomKey: true,
          updatedAt: null,
          type: 'number',
          secret: false,
        },
        scorer_api_key: {
          source: 'system',
          hasCustomKey: true,
          updatedAt: 12345,
          type: 'string',
          secret: true,
        },
      },
    });

    vi.spyOn(api, 'getExtensionConfig').mockResolvedValue({
      scanIntervalHours: 6,
      passiveMode: true,
      activeMode: false,
      maxPostingAgeDays: 30,
      titleFilter: { positive: [], negative: [] },
      locationFilter: { allow: [], block: [] },
      portals: {},
      trackedCompanies: [],
    });

    vi.spyOn(api, 'getDiagnostics').mockResolvedValue({
      status: 'healthy',
      uptime: 3600,
      timestamp: Date.now(),
      version: '0.1.0',
      database: {
        totalJobs: 42,
        unscoredJobs: 0,
        newJobs: 10,
        appliedJobs: 5,
        rejectedJobs: 2,
        totalUsers: 1,
        totalResumes: 2,
      },
      environment: {
        nodeVersion: 'v22.0.0',
        platform: 'linux',
      },
    });
    vi.spyOn(api, 'getResumes').mockResolvedValue([]);
    vi.spyOn(api, 'getTailoredJobs').mockResolvedValue([]);
  });

  const renderComponent = (onSaveSettings = vi.fn()) => {
    return render(
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <SettingsPage settings={mockSettings} onSaveSettings={onSaveSettings} />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    );
  };

  it('renders page header and tabs', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('System & Dashboard Settings')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Master Profile/i })).toBeInTheDocument();
    expect(screen.getByText(/Appearance & UI/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Engine & Models/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Fit Scorer/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Resume Tailor/i)).toBeInTheDocument();
    expect(screen.getByText(/Observability/i)).toBeInTheDocument();
    expect(screen.getByText(/Extension Pairing & Sync/i)).toBeInTheDocument();
    expect(screen.getByText(/Telemetry & System/i)).toBeInTheDocument();
  });

  it('switches to AI Fit Scorer tab and tests LLM connection', async () => {
    const testLlmSpy = vi.spyOn(api, 'testLlmConnection').mockResolvedValue({
      success: true,
      latencyMs: 150,
      message: 'Connected successfully to model (150ms)',
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Fit Scorer/i }));

    await waitFor(() => {
      expect(screen.getByText('LLM Fit Scorer Configuration')).toBeInTheDocument();
    });
    expect(screen.getByText('Database Override')).toBeInTheDocument();

    const testBtn = screen.getByTestId('test-llm-btn');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(testLlmSpy).toHaveBeenCalled();
      expect(screen.getAllByText(/Connected successfully to model/i).length).toBeGreaterThanOrEqual(
        1
      );
    });
  });

  it('shows the effective endpoint for a custom scorer without a base URL override', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Fit Scorer/i }));

    const target = await screen.findByTestId('test-llm-target-scorer');
    expect(target).toHaveTextContent(/Testing against:/i);
    // The scorer opts out of the gateway and has no base URL, so the provider
    // default is used — not an inherited gateway/proxy URL.
    expect(target).toHaveTextContent('https://openrouter.ai/api/v1');

    // Built-in providers display their fixed endpoint as read-only text, preventing
    // confusion with custom proxy overrides.
    expect(screen.getAllByText('https://openrouter.ai/api/v1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTitle('Endpoint is locked for built-in provider')).toBeInTheDocument();
  });

  it('updates settings and saves successfully', async () => {
    const updateSpy = vi.spyOn(api, 'updateSettings').mockResolvedValue({
      ok: true,
      settings: {
        scorer_model: 'custom/new-model',
        scorer_threshold: 85,
      } as any,
      meta: {} as any,
    });
    const onSaveSettings = vi.fn();

    renderComponent(onSaveSettings);
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    // Switch to Scorer tab and change model
    fireEvent.click(screen.getByRole('button', { name: /AI Fit Scorer/i }));
    const modelInput = screen.getByPlaceholderText('openrouter/z-ai/glm-5.3-flash');
    fireEvent.change(modelInput, { target: { value: 'custom/new-model' } });

    // Save changes
    const saveBtn = screen.getAllByRole('button', { name: /Save Changes/i })[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scorer_model: 'custom/new-model',
        })
      );
      expect(onSaveSettings).toHaveBeenCalled();
    });
  });

  it('renders provider dropdown, displays task tip, and allows fetching/selecting models', async () => {
    const fetchModelsSpy = vi.spyOn(api, 'fetchModels').mockResolvedValue({
      success: true,
      models: [
        { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
      ],
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Fit Scorer/i }));

    // Verify connection dropdown exists with known options
    const connSelect = screen.getByLabelText(/Scorer Connection Override/i);
    expect(connSelect).toBeInTheDocument();
    expect(within(connSelect).getByRole('option', { name: /Google Gemini/i })).toBeInTheDocument();
    expect(within(connSelect).getByRole('option', { name: /DeepSeek/i })).toBeInTheDocument();
    expect(within(connSelect).getByRole('option', { name: /OpenAI/i })).toBeInTheDocument();

    // Select DeepSeek connection
    fireEvent.change(connSelect, {
      target: { value: 'conn_builtin_deepseek' },
    });

    // Verify task tip for Scorer renders
    expect(
      screen.getByText(/Tip: For AI Fit Scorer, choose fast, cost-effective models/i)
    ).toBeInTheDocument();

    // Click Fetch Models button
    const fetchBtn = screen.getByRole('button', { name: /Fetch Models/i });
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(fetchModelsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'scorer', provider: 'deepseek' })
      );
    });

    // Select from model dropdown
    const modelSelect = screen.getByLabelText(/Select model for Scorer Model Identifier/i);
    fireEvent.change(modelSelect, { target: { value: 'deepseek/deepseek-v4.1-flash' } });

    expect(screen.getByPlaceholderText('openrouter/z-ai/glm-5.3-flash')).toHaveValue(
      'deepseek/deepseek-v4.1-flash'
    );
  });

  it('switches to AI Resume Tailor tab, inherits scorer settings, and tests connection', async () => {
    const testLlmSpy = vi.spyOn(api, 'testLlmConnection').mockResolvedValue({
      success: true,
      latencyMs: 180,
      message: 'Tailoring model responded OK',
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Resume Tailor/i }));

    await waitFor(() => {
      expect(screen.getByText('Resume Tailoring Engine (resume-ops)')).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText(/Inherit provider credentials from Default AI Gateway/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Also inherit model from Default AI Gateway/i)
    ).toBeInTheDocument();

    const tailorTestBtn = screen.getByTestId('test-tailor-llm-btn');
    fireEvent.click(tailorTestBtn);

    await waitFor(() => {
      expect(testLlmSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openrouter',
          apiKey: 'sk-or-••••••••0d60',
          model: 'openrouter/google/gemini-2.0-flash-exp:free',
        })
      );
      expect(screen.getAllByText(/Tailoring model responded OK/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('allows inheriting provider credentials while customizing the model for tailoring', async () => {
    const testLlmSpy = vi.spyOn(api, 'testLlmConnection').mockResolvedValue({
      success: true,
      latencyMs: 150,
      message: 'Custom tailor model responded OK',
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Resume Tailor/i }));

    await waitFor(() => {
      expect(screen.getByText('Resume Tailoring Engine (resume-ops)')).toBeInTheDocument();
    });

    // Uncheck "Also inherit model from Default AI Gateway"
    const inheritModelCheckbox = screen.getByLabelText(
      /Also inherit model from Default AI Gateway/i
    );
    fireEvent.click(inheritModelCheckbox);

    // Custom model input should now appear
    const tailorInput = screen.getByPlaceholderText('openrouter/anthropic/claude-3.5-sonnet');
    expect(tailorInput).toBeInTheDocument();

    fireEvent.change(tailorInput, {
      target: { value: 'openrouter/deepseek/deepseek-r1' },
    });

    const tailorTestBtn = screen.getByTestId('test-tailor-llm-btn');
    fireEvent.click(tailorTestBtn);

    await waitFor(() => {
      expect(testLlmSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openrouter',
          apiKey: 'sk-or-••••••••0d60',
          model: 'openrouter/deepseek/deepseek-r1',
        })
      );
    });
  });

  it('renders and configures advanced tailoring options (pipeline mode, instructions, final check, section overrides)', async () => {
    const updateSpy = vi.spyOn(api, 'updateSettings').mockResolvedValue({
      ok: true,
      settings: {
        tailor_pipeline_mode: 'sequential',
        tailor_instructions: 'Use British English. Avoid em dashes.',
        tailor_enable_final_check: true,
        tailor_final_check_model: 'openrouter/anthropic/claude-3.5-sonnet',
      } as any,
      meta: {} as any,
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Resume Tailor/i }));

    await waitFor(() => {
      expect(screen.getByText('Pipeline Execution Mode')).toBeInTheDocument();
      expect(screen.getByText('Custom Tailoring Instructions')).toBeInTheDocument();
      expect(screen.getByLabelText(/Enable Final Check \/ Critic Pass/i)).toBeInTheDocument();
    });

    // Enter custom instructions
    const instructionsTextarea = screen.getByPlaceholderText(
      /Custom instructions that apply across all sections/i
    );
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Use British English. Avoid em dashes.' },
    });

    // Toggle final check critic
    const criticCheckbox = screen.getByLabelText(/Enable Final Check \/ Critic Pass/i);
    fireEvent.click(criticCheckbox);

    // Enter critic model
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Leave empty to use primary tailoring model/i)
      ).toBeInTheDocument();
    });
    const criticModelInput = screen.getByPlaceholderText(
      /Leave empty to use primary tailoring model/i
    );
    fireEvent.change(criticModelInput, {
      target: { value: 'openrouter/anthropic/claude-3.5-sonnet' },
    });

    // Open prompt templates section
    const overridesBtn = screen.getByRole('button', {
      name: /Section Prompt Templates & Instructions Overrides/i,
    });
    fireEvent.click(overridesBtn);
    await waitFor(() => {
      expect(screen.getByText('Strategy & Basics Prompt')).toBeInTheDocument();
      expect(screen.getByText('Work Experience Prompt')).toBeInTheDocument();
    });

    // Save settings
    const saveBtn = screen.getAllByRole('button', { name: /Save Changes/i })[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tailor_instructions: 'Use British English. Avoid em dashes.',
          tailor_enable_final_check: true,
          tailor_final_check_model: 'openrouter/anthropic/claude-3.5-sonnet',
        })
      );
    });
  });

  it('navigates to Telemetry & System tab and displays live metrics', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Telemetry & System/i }));

    expect(screen.getByText('System Diagnostics & Architecture')).toBeInTheDocument();
    expect(screen.getByText('Total Jobs in DB')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/\/data\/jobfoundry.db/i)).toBeInTheDocument();
  });

  it('preserves custom provider when typing custom model names and displays model tip', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Fit Scorer/i }));

    // Select Ollama connection
    fireEvent.change(screen.getByLabelText(/Scorer Connection Override/i), {
      target: { value: 'conn_builtin_ollama' },
    });

    // Tip should be visible
    expect(
      screen.getByText(/Tip: For AI Fit Scorer, choose fast, cost-effective models/i)
    ).toBeInTheDocument();

    // Type a model name without a provider prefix
    const modelInput = screen.getByPlaceholderText('openrouter/z-ai/glm-5.3-flash');
    fireEvent.change(modelInput, { target: { value: 'my-custom-mistral' } });

    // Ollama connection should remain selected
    expect(screen.getByLabelText(/Scorer Connection Override/i)).toHaveValue('conn_builtin_ollama');
  });

  it('preserves gateway connection and shows endpoint when typing model names', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    // Navigate to Gateway tab
    fireEvent.click(screen.getByRole('button', { name: /AI Engine & Models/i }));

    // Select Ollama connection
    fireEvent.change(screen.getByLabelText(/Primary Gateway Connection/i), {
      target: { value: 'conn_builtin_ollama' },
    });
    expect(screen.getByLabelText(/Primary Gateway Connection/i)).toHaveValue('conn_builtin_ollama');

    // Endpoint display should reflect Ollama's URL
    expect(screen.getAllByText('http://127.0.0.1:11434/v1').length).toBeGreaterThanOrEqual(1);

    // Type a model with or without prefix
    const defaultModelInput = screen.getByDisplayValue(
      'openrouter/google/gemini-2.0-flash-exp:free'
    );
    fireEvent.change(defaultModelInput, { target: { value: 'openai/my-proxied-model' } });

    // Connection remains selected and endpoint is shown
    expect(screen.getByLabelText(/Primary Gateway Connection/i)).toHaveValue('conn_builtin_ollama');
    expect(screen.getAllByText('http://127.0.0.1:11434/v1').length).toBeGreaterThanOrEqual(1);
  });

  it('allows editing API key with inline Save and Cancel options', async () => {
    const updateSpy = vi.spyOn(api, 'updateSettings').mockResolvedValue({
      ok: true,
      settings: {
        scorer_api_key: 'sk-or-••••••••9999',
      } as any,
      meta: {} as any,
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Fit Scorer/i }));

    // Initially displays masked key and Change Key button
    const changeKeyBtn = screen.getByRole('button', { name: /Change Key/i });
    expect(changeKeyBtn).toBeInTheDocument();

    // Click Change Key
    fireEvent.click(changeKeyBtn);

    // Save and Cancel buttons should both be present
    const saveKeyBtn = screen.getByRole('button', { name: /^Save$/i });
    const cancelKeyBtn = screen.getByRole('button', { name: /^Cancel$/i });
    expect(saveKeyBtn).toBeInTheDocument();
    expect(cancelKeyBtn).toBeInTheDocument();

    // Save button disabled when input is empty
    expect(saveKeyBtn).toBeDisabled();

    // Enter a new key
    const keyInput = screen.getByPlaceholderText(/sk-or-v1/i);
    fireEvent.change(keyInput, { target: { value: 'sk-or-v1-new-secret-key-12345' } });
    expect(saveKeyBtn).not.toBeDisabled();

    // Click Save
    fireEvent.click(saveKeyBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scorer_api_key: 'sk-or-v1-new-secret-key-12345',
        })
      );
    });
  });

  it('renders API key input directly when key is unconfigured without requiring Change Key', async () => {
    vi.spyOn(api, 'getSettings').mockResolvedValue({
      settings: {
        ...mockSettings.settings,
        default_llm_api_key: '',
        scorer_api_key: '',
      } as any,
      meta: {} as any,
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Engine & Models/i }));

    // Input field should be visible directly without Change Key button
    expect(screen.queryByRole('button', { name: /Change Key/i })).not.toBeInTheDocument();
    const gatewayKeyInput = screen.getByPlaceholderText(/sk-or-v1/i);
    expect(gatewayKeyInput).toBeInTheDocument();
  });

  it('navigates to Default AI Gateway tab, displays engine inheritance and tests connection', async () => {
    const testLlmSpy = vi.spyOn(api, 'testLlmConnection').mockResolvedValue({
      success: true,
      latencyMs: 120,
      message: 'Default Gateway connected (120ms)',
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Engine & Models/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Default AI Gateway \(Primary Model & Credentials\)/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Engine Inheritance Overview')).toBeInTheDocument();
    expect(screen.getByTestId('test-gateway-llm-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('test-gateway-llm-btn'));

    await waitFor(() => {
      expect(testLlmSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'gateway',
        })
      );
    });
  });

  it('redirects to tab=gateway when LLM key is not configured and visiting scorer tab', async () => {
    vi.spyOn(api, 'getSettings').mockResolvedValue({
      settings: {
        default_llm_api_key: '',
        scorer_api_key: '',
        default_llm_model: 'openrouter/openrouter/free',
      } as any,
      meta: {
        default_llm_api_key: { hasCustomKey: false },
        scorer_api_key: { hasCustomKey: false },
      } as any,
    });

    window.history.pushState({}, '', '/settings?tab=scorer');

    renderComponent();
    await waitFor(() => {
      expect(
        screen.getByText(/Default AI Gateway \(Primary Model & Credentials\)/i)
      ).toBeInTheDocument();
    });
  });

  it('triggers downloads for JSON Resume, CSV, and Archive in System tab', async () => {
    const downloadSpy = vi.spyOn(api, 'downloadExport').mockResolvedValue({
      blob: new Blob(['test-data']),
      filename: 'test-export.json',
    });

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/test-export');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    // Switch to Telemetry & System tab
    fireEvent.click(screen.getByRole('button', { name: /Telemetry & System/i }));

    expect(screen.getByText('Data Export')).toBeInTheDocument();

    const jsonResumeBtn = screen.getByRole('button', { name: /JSON Resume/i });
    const csvBtn = screen.getByRole('button', { name: /Job History CSV/i });
    const archiveBtn = screen.getByRole('button', { name: /Full Archive \(\.zip\)/i });

    expect(jsonResumeBtn).toBeInTheDocument();
    expect(csvBtn).toBeInTheDocument();
    expect(archiveBtn).toBeInTheDocument();

    fireEvent.click(jsonResumeBtn);
    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith('json-resume');
    });

    fireEvent.click(csvBtn);
    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith('csv');
    });

    fireEvent.click(archiveBtn);
    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith('archive');
    });

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('downloads a job-tailored JSON Resume variant from the System tab', async () => {
    vi.mocked(api.getTailoredJobs).mockResolvedValue([
      {
        id: 'job-1',
        title: 'Staff Engineer',
        company: 'CloudCorp',
        tailored_resume_id: 'tailored-1',
        updated_at: 1000,
      },
    ]);
    const downloadSpy = vi.spyOn(api, 'downloadExport').mockResolvedValue({
      blob: new Blob(['{}']),
      filename: 'json-resume-job-1.json',
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/tailored');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Telemetry & System/i }));

    await waitFor(() => {
      expect(api.getTailoredJobs).toHaveBeenCalled();
      expect(screen.getByRole('option', { name: /Staff Engineer — CloudCorp/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tailored variant/i }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith('json-resume', { jobId: 'job-1' });
    });
  });

  it('allows retrying when tailored jobs fail to load', async () => {
    vi.mocked(api.getTailoredJobs)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([
        {
          id: 'job-2',
          title: 'Principal Engineer',
          company: 'DataCorp',
          tailored_resume_id: 'tailored-2',
          updated_at: 2000,
        },
      ]);

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Telemetry & System/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Principal Engineer — DataCorp/i })).toBeVisible();
    });
    expect(api.getTailoredJobs).toHaveBeenCalledTimes(2);
  });

  it('switches between observability providers (Opik, Langfuse, LangSmith) and edits keys', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Observability & Tracing/i }));

    await waitFor(() => {
      expect(screen.getByText(/LLM Observability & Tracing/i)).toBeInTheDocument();
      expect(screen.getByText(/Enable Opik Tracing Callbacks/i)).toBeInTheDocument();
    });

    // Switch to Langfuse
    fireEvent.click(screen.getByRole('button', { name: 'Langfuse' }));
    expect(screen.getByText(/Enable Langfuse Tracing Callbacks/i)).toBeInTheDocument();
    expect(screen.getByText(/No Langfuse public key configured/i)).toBeInTheDocument();

    // Switch to LangSmith
    fireEvent.click(screen.getByRole('button', { name: 'LangSmith' }));
    expect(screen.getByText(/Enable LangSmith Tracing Callbacks/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://api.smith.langchain.com')).toBeInTheDocument();
  });

  it('renders all 14 curated themes in the Default Resume Theme dropdown', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Resume Tailor/i }));

    await waitFor(() => {
      expect(screen.getByText('Default Resume Theme')).toBeInTheDocument();
    });

    expect(screen.getByRole('option', { name: /Jake Technical/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Harvard Classic/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Pro \(/i })).toBeInTheDocument();
  });

  it('clicks engine inheritance overview card and navigates directly to that engine tab', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    // Navigate to AI Engine & Models (Gateway) tab
    fireEvent.click(screen.getByRole('button', { name: /AI Engine & Models/i }));
    expect(screen.getByText('Engine Inheritance Overview')).toBeInTheDocument();

    // Click the Resume Tailor engine card
    const tailorCard = screen.getByTitle('Click to configure Resume Tailor');
    expect(tailorCard).toBeInTheDocument();
    fireEvent.click(tailorCard);

    // Should now be on the Resume Tailor tab
    await waitFor(() => {
      expect(screen.getByText('Default Resume Theme')).toBeInTheDocument();
    });
  });
});
