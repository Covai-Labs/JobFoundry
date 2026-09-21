import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TailorButton } from '../TailorButton';
import { Job } from '../../../types/job';
import { api } from '../../../api/client';

const mockJob: Job = {
  id: 'job-123',
  title: 'Backend Engineer',
  company: 'Cloud Corp',
  location: 'Remote',
  url: 'https://example.com/job',
  source: 'web',
  status: 'new',
  description: 'Design distributed storage systems.',
  created_at: 1700000000000,
  updated_at: 1700000000000,
};

describe('TailorButton', () => {
  it('renders Tailor CV button when job is not tailored', async () => {
    const spy = vi.spyOn(api, 'tailor').mockResolvedValue({
      ok: true,
      job: { ...mockJob, status: 'tailored' },
    });
    const onTailored = vi.fn();

    render(<TailorButton job={mockJob} onTailored={onTailored} />);

    const button = screen.getByRole('button', { name: /Tailor CV/ });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(spy).toHaveBeenCalledWith('job-123');
  });

  it('renders Tailored badge and Re-tailor button when job is already tailored', async () => {
    const tailoredJob: Job = {
      ...mockJob,
      status: 'tailored',
      tailored_resume_id: 'resume-tailored-1',
    };
    const spy = vi.spyOn(api, 'tailor').mockResolvedValue({
      ok: true,
      job: tailoredJob,
    });
    const onTailored = vi.fn();

    render(<TailorButton job={tailoredJob} onTailored={onTailored} />);

    expect(screen.getByText(/Tailored ✓/)).toBeInTheDocument();

    const retailorBtn = screen.getByRole('button', { name: /🔄 Re-tailor/ });
    expect(retailorBtn).toBeInTheDocument();

    fireEvent.click(retailorBtn);
    expect(spy).toHaveBeenCalledWith('job-123');
  });
});
