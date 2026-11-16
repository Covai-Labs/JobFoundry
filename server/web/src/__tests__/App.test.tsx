import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { Job } from '../types/job';

const mockJobs: Job[] = [
  {
    id: 'job-1',
    title: 'Lead Architect',
    company: 'NextGen Systems',
    location: 'Remote',
    url: 'https://example.com/job-1',
    source: 'linkedin',
    liveness: 'active',
    fit_score: 95,
    fit_notes: JSON.stringify({
      reasoning: 'Exceptional architectural alignment',
      matching_skills: ['Python', 'Distributed Systems'],
      missing_skills: [],
    }),
    status: 'new',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: { id: 'u1', email: 'test@example.com', name: 'Tester', apiKey: 'jf_test' },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ jobs: mockJobs, resumes: [] }),
      });
    });
  });

  it('renders login view when unauthenticated', async () => {
    render(<App />);
    expect(
      screen.getByText('Sign in to access your automated job command center')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('renders dashboard when logged in with stored session', async () => {
    localStorage.setItem('jf_auth_token', 'valid-jwt-token');
    localStorage.setItem(
      'jf_auth_user',
      JSON.stringify({ id: 'u1', email: 'test@example.com', name: 'Tester', apiKey: 'jf_test' })
    );

    render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('Job')).toBeInTheDocument();
        expect(screen.getByText('Foundry')).toBeInTheDocument();
        expect(screen.getByText('Job Feed')).toBeInTheDocument();
        expect(screen.getByText('Tracker')).toBeInTheDocument();
        expect(screen.getAllByText('Lead Architect').length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 10000 }
    );
  });

  it('opens and closes user menu dropdown with appearance and navigation options', async () => {
    localStorage.setItem('jf_auth_token', 'valid-jwt-token');
    localStorage.setItem(
      'jf_auth_user',
      JSON.stringify({ id: 'u1', email: 'test@example.com', name: 'Tester', apiKey: 'jf_test' })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Tester')).toBeInTheDocument();
    });

    // Dropdown should be initially closed
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();

    // Click trigger to open
    const trigger = screen.getByLabelText('User account and settings menu');
    fireEvent.click(trigger);

    // Dropdown items visible
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Settings & Themes')).toBeInTheDocument();
    expect(screen.getByText('Support JobFoundry')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();

    // Escape closes menu
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
  });

  it('renders tracker with sub-view switcher links and switches between Board and Pipeline', async () => {
    localStorage.setItem('jf_auth_token', 'valid-jwt-token');
    localStorage.setItem(
      'jf_auth_user',
      JSON.stringify({ id: 'u1', email: 'test@example.com', name: 'Tester', apiKey: 'jf_test' })
    );
    window.history.pushState({}, '', '/tracker');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /board/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /pipeline & analytics/i })).toBeInTheDocument();
    });

    const pipelineTab = screen.getByRole('link', { name: /pipeline & analytics/i });
    fireEvent.click(pipelineTab);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/tracker/pipeline');
    });
  });
});
