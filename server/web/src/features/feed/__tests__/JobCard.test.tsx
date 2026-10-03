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

  it('renders Mark Applied button when onStatusChange is provided and triggers status update', () => {
    const onStatusChange = vi.fn();
    const onSelect = vi.fn();
    render(<JobCard job={mockJob} onSelect={onSelect} onStatusChange={onStatusChange} />);

    const applyBtn = screen.getByRole('button', { name: /Mark Applied/i });
    expect(applyBtn).toBeInTheDocument();

    fireEvent.click(applyBtn);
    expect(onStatusChange).toHaveBeenCalledWith('job-999', 'applied');
    // Ensure card onSelect was not triggered
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders Applied badge when job status is applied', () => {
    const appliedJob: Job = { ...mockJob, status: 'applied' };
    render(<JobCard job={appliedJob} onSelect={vi.fn()} onStatusChange={vi.fn()} />);

    expect(screen.getByTitle('Marked as Applied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Applied/i })).not.toBeInTheDocument();
  });
});
