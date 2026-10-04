import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobWorkbench } from '../../feed/JobWorkbench';
import { JobDetailModal } from '../JobDetailModal';
import { Job } from '../../../types/job';

vi.mock('../../tailor/TailorButton', () => ({
  TailorButton: () => <button type="button">Tailor CV</button>,
}));

vi.mock('../../copilot/CopilotView', () => ({
  CopilotView: ({ jobId }: { jobId: string }) => <div>Copilot for {jobId}</div>,
}));

const baseJob: Job = {
  id: 'job-1',
  title: 'Platform Engineer',
  company: 'Acme',
  location: 'Remote',
  url: 'https://jobs.example.com/1',
  source: 'web',
  liveness: 'active',
  status: 'new',
  description: 'Build reliable distributed systems.',
  created_at: 1700000000000,
  updated_at: 1700000000000,
};

const noopHandlers = {
  onStatusChange: vi.fn(),
  onJobUpdated: vi.fn(),
};

describe('JobDetail unification (workbench shell === modal shell)', () => {
  it.each([
    ['workbench', () => render(<JobWorkbench job={baseJob} {...noopHandlers} />)],
    ['modal', () => render(<JobDetailModal job={baseJob} onClose={vi.fn()} {...noopHandlers} />)],
  ])('%s renders the same Copilot tab', (_name, renderShell) => {
    const { unmount } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: /Copilot/ }));
    expect(screen.getByText('Copilot for job-1')).toBeInTheDocument();
    unmount();
  });

  it.each([
    ['workbench', () => render(<JobWorkbench job={baseJob} {...noopHandlers} />)],
    ['modal', () => render(<JobDetailModal job={baseJob} onClose={vi.fn()} {...noopHandlers} />)],
  ])('%s renders the same Notes tab', (_name, renderShell) => {
    const { unmount } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: /Notes & Prep/ }));
    expect(screen.getByText('Interview & Application Notes')).toBeInTheDocument();
    unmount();
  });

  it.each([
    ['workbench', () => render(<JobWorkbench job={baseJob} {...noopHandlers} />)],
    ['modal', () => render(<JobDetailModal job={baseJob} onClose={vi.fn()} {...noopHandlers} />)],
  ])('%s renders the same Re-score affordance', (_name, renderShell) => {
    const { unmount } = renderShell();
    expect(screen.getByRole('button', { name: /^Re-score$/ })).toBeInTheDocument();
    unmount();
  });

  it.each([
    ['workbench', () => render(<JobWorkbench job={baseJob} {...noopHandlers} />)],
    ['modal', () => render(<JobDetailModal job={baseJob} onClose={vi.fn()} {...noopHandlers} />)],
  ])('%s copies the canonical job URL to clipboard', async (_name, renderShell) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(window.navigator, { clipboard: { writeText } });

    const { unmount } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: /Copy Link/ }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/jobs/job-1`);
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument();
    unmount();
  });

  it.each([
    ['workbench', () => render(<JobWorkbench job={baseJob} {...noopHandlers} />)],
    ['modal', () => render(<JobDetailModal job={baseJob} onClose={vi.fn()} {...noopHandlers} />)],
  ])('%s renders job provenance and pipeline origin info', (_name, renderShell) => {
    const { unmount } = renderShell();
    expect(screen.getByText('Job Provenance & Pipeline Origin')).toBeInTheDocument();
    expect(screen.getByText('Capture Method')).toBeInTheDocument();
    expect(screen.getByText('Original Source URL')).toBeInTheDocument();
    expect(screen.getByText('jobs.example.com')).toBeInTheDocument();
    unmount();
  });

  it('cleans up temporary textarea when copy URL fallback fails', async () => {
    // Delete clipboard API to force fallback
    const origClipboard = window.navigator.clipboard;
    // @ts-ignore
    delete window.navigator.clipboard;

    const origExec = (document as any).execCommand;
    (document as any).execCommand = vi.fn().mockImplementation(() => {
      throw new Error('execCommand copy failed');
    });

    render(<JobWorkbench job={baseJob} {...noopHandlers} />);

    const copyBtn = screen.getByTitle(/Copy full origin URL/i);
    fireEvent.click(copyBtn);

    // Verify textarea was cleaned up from body despite failure
    expect(document.querySelector('textarea')).toBeNull();

    if (origExec) {
      (document as any).execCommand = origExec;
    } else {
      delete (document as any).execCommand;
    }
    Object.assign(window.navigator, { clipboard: origClipboard });
  });
});
