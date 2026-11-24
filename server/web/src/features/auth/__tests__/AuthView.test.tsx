import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginView } from '../LoginView';
import { RegisterView } from '../RegisterView';
import { AuthProvider } from '../../../context/AuthContext';

describe('Auth Views Theme and Structure', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/registration')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ open: true, userCount: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-color-mode');
    document.documentElement.classList.remove('light');
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <MemoryRouter>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    );

  it('renders LoginView with theme-aware surfaces, high-contrast labels, and visible brand header', async () => {
    document.documentElement.setAttribute('data-color-mode', 'light');
    document.documentElement.classList.add('light');

    renderWithProviders(<LoginView onSwitchToRegister={vi.fn()} />);

    const container = screen.getByTestId('auth-page-container');
    expect(container.style.background).toBe('var(--bg-primary)');

    const card = screen.getByTestId('auth-card');
    expect(card.style.background).toBe('var(--bg-card)');
    expect(card.style.border).toBe('1px solid var(--border-subtle)');

    const titleElement = await screen.findByRole('heading', { level: 1 });
    expect(titleElement).toHaveTextContent('JobFoundry');
    expect(titleElement.style.color).toBe('var(--text-primary)');

    const emailLabel = screen.getByText('Email Address');
    expect(emailLabel.style.color).toBe('var(--text-primary)');

    const passwordLabel = screen.getByText('Password');
    expect(passwordLabel.style.color).toBe('var(--text-primary)');

    const switchBtn = await screen.findByRole('button', { name: /create account/i });
    expect(switchBtn).toHaveClass('auth-switch-link');
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('renders RegisterView with theme-aware surfaces and labels in dark mode', async () => {
    document.documentElement.setAttribute('data-color-mode', 'dark');

    renderWithProviders(<RegisterView onSwitchToLogin={vi.fn()} />);

    const container = screen.getByTestId('auth-page-container');
    expect(container.style.background).toBe('var(--bg-primary)');

    const card = screen.getByTestId('auth-card');
    expect(card.style.background).toBe('var(--bg-card)');
    expect(card.style.border).toBe('1px solid var(--border-subtle)');

    const titleElement = await screen.findByRole('heading', { level: 1 });
    expect(titleElement).toHaveTextContent('Create Account');
    expect(titleElement.style.color).toBe('var(--text-primary)');

    const nameLabel = screen.getByText('Full Name');
    expect(nameLabel.style.color).toBe('var(--text-primary)');

    const switchBtn = await screen.findByRole('button', { name: /sign in/i });
    expect(switchBtn).toHaveClass('auth-switch-link');
  });
});
