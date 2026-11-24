import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginView } from '../LoginView';
import { RegisterView } from '../RegisterView';
import { AuthProvider } from '../../../context/AuthContext';

describe('Auth Views Theme and Structure', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ open: true, userCount: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });
  });

  it('renders LoginView with theme-aware background, labels, and visible JobFoundry header', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginView onSwitchToRegister={vi.fn()} />
        </AuthProvider>
      </MemoryRouter>
    );

    const titleElement = await screen.findByRole('heading', { level: 1 });
    expect(titleElement).toHaveTextContent('JobFoundry');
    expect(titleElement.style.color).toBe('var(--text-primary)');

    const emailLabel = screen.getByText('Email Address');
    expect(emailLabel.style.color).toBe('var(--text-primary)');

    const passwordLabel = screen.getByText('Password');
    expect(passwordLabel.style.color).toBe('var(--text-primary)');

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('renders RegisterView with theme-aware background and labels', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterView onSwitchToLogin={vi.fn()} />
        </AuthProvider>
      </MemoryRouter>
    );

    const titleElement = await screen.findByRole('heading', { level: 1 });
    expect(titleElement).toHaveTextContent('Create Account');
    expect(titleElement.style.color).toBe('var(--text-primary)');

    const nameLabel = screen.getByText('Full Name');
    expect(nameLabel.style.color).toBe('var(--text-primary)');

    const emailLabel = screen.getByText('Email Address');
    expect(emailLabel.style.color).toBe('var(--text-primary)');

    const passwordLabel = screen.getByText('Password');
    expect(passwordLabel.style.color).toBe('var(--text-primary)');
  });
});
