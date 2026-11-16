import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobCard } from '../JobCard';
import { Job } from '../../../types/job';

vi.mock('../../tailor/TailorButton', () => ({
  TailorButton: () => <button type="button">Tailor CV</button>,
}));

const mockJob: Job = {
  id: 'job-999',
  title: 'Full Stack Engineer',
  company: 'Antigravity Systems',
  location: 'Remote',
  url: 'https://antigravity.example/jobs/999',
  source: 'greenhouse',
  liveness: 'active',
  status: 'new',
  created_at: Date.now(),
  updated_at: Date.now(),
};

describe('JobCard Component', () => {
  it('renders job title and company', () => {
    render(<JobCard job={mockJob} onSelect={vi.fn()} />);
    expect(screen.getByText('Full Stack Engineer')).toBeInTheDocument();
    expect(screen.getByText('Antigravity Systems')).toBeInTheDocument();
  });

  it('marks a job applied in one click without selecting the card', () => {
    const onStatusChange = vi.fn();
    const onSelect = vi.fn();
    render(<JobCard job={mockJob} onSelect={onSelect} onStatusChange={onStatusChange} />);

    const applyBtn = screen.getByRole('button', { name: /Mark Applied/i });
    expect(applyBtn).toBeInTheDocument();

    fireEvent.click(applyBtn);
    expect(onStatusChange).toHaveBeenCalledWith('job-999', 'applied');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the current stage as a readable label', () => {
    render(<JobCard job={{ ...mockJob, status: 'interview' }} onSelect={vi.fn()} />);

    expect(screen.getByText('Interview')).toBeInTheDocument();
  });

  it('hides the quick apply action once the job is past the apply loop', () => {
    const { rerender } = render(
      <JobCard
        job={{ ...mockJob, status: 'applied' }}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Mark Applied/i })).not.toBeInTheDocument();

    rerender(
      <JobCard
        job={{ ...mockJob, status: 'rejected_by_score' }}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Mark Applied/i })).not.toBeInTheDocument();
  });

  it('renders repost badge only when repost_confidence is high', () => {
    const highRepostJob: Job = {
      ...mockJob,
      repost_confidence: 'high',
      repost_status: JSON.stringify({
        isRepost: true,
        count: 2,
        daysSpan: 60,
        confidence: 'high',
        reason: 'Seen 2 matching role(s) over 60 days at Antigravity Systems',
      }),
    };

    const { rerender } = render(<JobCard job={highRepostJob} onSelect={vi.fn()} />);
    const badge = screen.getByText(/Repost/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute(
      'title',
      'Seen 2 matching role(s) over 60 days at Antigravity Systems'
    );

    // Medium confidence: should not display badge
    rerender(
      <JobCard
        job={{ ...mockJob, repost_confidence: 'medium', repost_status: 'Seen 1 matching role' }}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByText(/Repost/i)).not.toBeInTheDocument();

    // None confidence: should not display badge
    rerender(<JobCard job={{ ...mockJob, repost_confidence: 'none' }} onSelect={vi.fn()} />);
    expect(screen.queryByText(/Repost/i)).not.toBeInTheDocument();
  });
});
