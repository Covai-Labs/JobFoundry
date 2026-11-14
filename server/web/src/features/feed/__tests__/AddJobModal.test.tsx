import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddJobModal } from '../AddJobModal';
import { api } from '../../../api/client';

describe('AddJobModal', () => {
  it('renders URL import tab by default and allows tab switching', () => {
    const onClose = vi.fn();
    const onJobAdded = vi.fn();

    render(<AddJobModal onClose={onClose} onJobAdded={onJobAdded} />);

    expect(screen.getByText('Add Job to Pipeline')).toBeDefined();
    expect(screen.getByText('🔗 Quick URL Import')).toBeDefined();
    expect(screen.getByText('⚡ Paste JD & Auto-Parse (AI)')).toBeDefined();
    expect(screen.getByText('✏️ Job Details & Review')).toBeDefined();

    // URL tab is active by default
    expect(
      screen.getByPlaceholderText(
        'https://jobs.example.com/posting/123 or LinkedIn/Indeed/Lever link'
      )
    ).toBeDefined();

    // Click Manual tab
    fireEvent.click(screen.getByText('✏️ Job Details & Review'));
    expect(screen.getByText('Job Title *')).toBeDefined();
    expect(screen.getByText('Company Name *')).toBeDefined();
  });

  it('submits job via URL import to pipeline and calls ingestJobs', async () => {
    const onClose = vi.fn();
    const onJobAdded = vi.fn();

    const ingestSpy = vi.spyOn(api, 'ingestJobs').mockResolvedValueOnce({
      ingested: 1,
      deduped: 0,
      ids: ['job_url_123'],
    });

    vi.spyOn(api, 'getJob').mockResolvedValueOnce({
      id: 'job_url_123',
      title: 'Senior AI Engineer',
      company: 'Distru',
      location: 'Remote',
      url: 'https://jobs.lever.co/distru/9c3ca4f6-fd74-4d70-b7e3-682c914c1a22',
      source: 'url_import',
      description: '',
      status: 'new',
      liveness: 'unknown',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    render(<AddJobModal onClose={onClose} onJobAdded={onJobAdded} />);

    const urlInput = screen.getByPlaceholderText(
      'https://jobs.example.com/posting/123 or LinkedIn/Indeed/Lever link'
    );
    fireEvent.change(urlInput, {
      target: { value: 'https://jobs.lever.co/distru/9c3ca4f6-fd74-4d70-b7e3-682c914c1a22' },
    });

    const submitBtn = screen.getByText('➕ Add to Pipeline');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ingestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://jobs.lever.co/distru/9c3ca4f6-fd74-4d70-b7e3-682c914c1a22',
          company: 'Distru',
          source: 'url_import',
        })
      );
      expect(onJobAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job_url_123',
          company: 'Distru',
        })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles auto-parse with AI when switching to paste tab', async () => {
    const onClose = vi.fn();
    const onJobAdded = vi.fn();

    vi.spyOn(api, 'parseJd').mockResolvedValueOnce({
      ok: true,
      job: {
        title: 'Senior AI Engineer',
        company: 'Anthropic',
        location: 'San Francisco, CA',
        salary: '$200k - $250k',
        employmentType: 'Full-time',
        description: 'AI Infrastructure and model evaluation.',
        requirements: ['Python', 'LLM evaluation'],
        url: 'https://jobs.example.com/ai-eng',
      },
    });

    render(<AddJobModal onClose={onClose} onJobAdded={onJobAdded} />);

    // Switch to paste tab
    fireEvent.click(screen.getByText('⚡ Paste JD & Auto-Parse (AI)'));

    const textarea = screen.getByPlaceholderText(
      'Paste the full job description, requirements, or web page text here...'
    );
    fireEvent.change(textarea, {
      target: { value: '# Senior AI Engineer at Anthropic\nLocation: San Francisco, CA' },
    });

    const parseBtn = screen.getByText('✨ Auto-Parse with AI');
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Senior AI Engineer')).toBeDefined();
      expect(screen.getByDisplayValue('Anthropic')).toBeDefined();
    });
  });
});
