import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionsManager } from '../ConnectionsManager';
import { ConnectionSelector } from '../ConnectionSelector';
import { ToastProvider } from '../../../context/ToastContext';
import { api, LLMConnection } from '../../../api/client';

const mockConnections: LLMConnection[] = [
  {
    id: 'conn_builtin_openrouter',
    name: 'OpenRouter',
    apiType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '••••••••',
    isConfigured: true,
    isBuiltIn: true,
    inUseBy: ['gateway'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'conn_builtin_openai',
    name: 'OpenAI',
    apiType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    isConfigured: false,
    isBuiltIn: true,
    inUseBy: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'conn_custom_1',
    name: 'Self-Hosted Ollama',
    apiType: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    isConfigured: false,
    isBuiltIn: false,
    inUseBy: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('ConnectionsManager & ConnectionSelector', () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders connections list including built-in and custom', () => {
    render(
      <ToastProvider>
        <ConnectionsManager connections={mockConnections} onRefresh={onRefresh} />
      </ToastProvider>
    );

    expect(screen.getByText('AI Connections & Endpoints')).toBeDefined();
    expect(screen.getByText('OpenRouter')).toBeDefined();
    expect(screen.getByText('OpenAI')).toBeDefined();
    expect(screen.getByText('Self-Hosted Ollama')).toBeDefined();
  });

  it('tests connection when Test button is clicked', async () => {
    const testSpy = vi.spyOn(api, 'testConnection').mockResolvedValue({
      ok: true,
      endpoint: 'https://openrouter.ai/api/v1',
      latencyMs: 145,
      message: 'Connection healthy',
    });

    render(
      <ToastProvider>
        <ConnectionsManager connections={mockConnections} onRefresh={onRefresh} />
      </ToastProvider>
    );

    const testButtons = screen.getAllByRole('button', { name: /test/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(testSpy).toHaveBeenCalledWith('conn_builtin_openrouter');
      expect(screen.getAllByText(/145ms/i).length).toBeGreaterThan(0);
    });
  });

  it('opens and submits create custom connection modal', async () => {
    const createSpy = vi.spyOn(api, 'createConnection').mockResolvedValue({
      id: 'conn_custom_2',
      name: 'Local vLLM',
      apiType: 'openai',
      baseUrl: 'http://127.0.0.1:8000/v1',
      apiKey: '',
      isConfigured: false,
      isBuiltIn: false,
      inUseBy: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    render(
      <ToastProvider>
        <ConnectionsManager connections={mockConnections} onRefresh={onRefresh} />
      </ToastProvider>
    );

    const addBtn = screen.getByRole('button', { name: /add connection/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add Custom Connection')).toBeDefined();

    const nameInput = screen.getByPlaceholderText(/e\.g\. my litellm proxy or work openai/i);
    const urlInput = screen.getByPlaceholderText('https://litellm.example.com/v1');

    fireEvent.change(nameInput, { target: { value: 'Local vLLM' } });
    fireEvent.change(urlInput, { target: { value: 'http://127.0.0.1:8000/v1' } });

    const createBtn = screen.getByRole('button', { name: /create connection/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Local vLLM',
        apiType: 'openai',
        baseUrl: 'http://127.0.0.1:8000/v1',
        apiKey: '',
      });
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('deletes custom connection after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteSpy = vi.spyOn(api, 'deleteConnection').mockResolvedValue(true);

    render(
      <ToastProvider>
        <ConnectionsManager connections={mockConnections} onRefresh={onRefresh} />
      </ToastProvider>
    );

    const deleteBtn = screen.getByTitle('Delete custom connection');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('conn_custom_1');
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('ConnectionSelector renders selected connection and notifies on change', () => {
    const onSelect = vi.fn();
    const onManage = vi.fn();

    render(
      <ConnectionSelector
        label="Test Gateway Connection"
        selectedConnectionId="conn_builtin_openrouter"
        connections={mockConnections}
        onSelectConnectionId={onSelect}
        onManageConnections={onManage}
      />
    );

    expect(screen.getByText('Test Gateway Connection')).toBeDefined();
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();

    fireEvent.change(select, { target: { value: 'conn_custom_1' } });
    expect(onSelect).toHaveBeenCalledWith('conn_custom_1');

    const manageBtn = screen.getByRole('button', { name: /manage connections/i });
    fireEvent.click(manageBtn);
    expect(onManage).toHaveBeenCalled();
  });

  it('ConnectionSelector handles onAddConnection and custom proxy tips', () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn();

    const { rerender } = render(
      <ConnectionSelector
        label="Test Scorer Connection"
        selectedConnectionId="conn_builtin_openai"
        connections={mockConnections}
        onSelectConnectionId={onSelect}
        onAddConnection={onAdd}
      />
    );

    // Header "+ Add Custom Connection" button
    const addButtons = screen.getAllByRole('button', { name: /add custom connection/i });
    expect(addButtons.length).toBe(2); // One in header, one in tip
    fireEvent.click(addButtons[0]);
    expect(onAdd).toHaveBeenCalledTimes(1);

    // Tip button click
    fireEvent.click(addButtons[1]);
    expect(onAdd).toHaveBeenCalledTimes(2);

    // Fallback when no callbacks are provided
    rerender(
      <ConnectionSelector
        label="Test Scorer Connection"
        selectedConnectionId="conn_builtin_openai"
        connections={mockConnections}
        onSelectConnectionId={onSelect}
      />
    );
    expect(screen.getByText(/Add a custom connection in Connections settings/i)).toBeDefined();
  });
});
