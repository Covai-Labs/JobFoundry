import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResumeManager } from '../ResumeManager';
import { api, UserResume } from '../../../api/client';

const mockResume: UserResume = {
  id: 'resume-1',
  userId: 'user-1',
  title: 'Lead Architect',
  resume: {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: 'Alex Mercer',
      label: 'Staff Distributed Systems Engineer',
      email: 'alex@mercer.dev',
      phone: '+1 555-0199',
      url: 'https://alex.mercer.dev',
      summary: 'Specializing in fault-tolerant high-throughput event logs.',
      location: { city: 'Seattle', region: 'WA' },
    },
    skills: [{ name: 'Core Languages', keywords: ['Rust', 'Go', 'TypeScript'] }],
    work: [
      {
        name: 'Distributed Cloud Inc',
        position: 'Staff Engineer',
        startDate: '2021-01-01',
        highlights: ['Designed high-throughput Kafka ingestion engine.'],
      },
    ],
    education: [
      {
        institution: 'University of Washington',
        studyType: 'B.S.',
        area: 'Computer Science',
        startDate: '2016-09-01',
        endDate: '2020-06-01',
      },
    ],
  },
  isActive: true,
  createdAt: 1000,
  updatedAt: 1000,
};

describe('ResumeManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getFacts').mockResolvedValue([]);
  });

  it('renders form editor by default and displays active profile details', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);

    render(<ResumeManager />);

    expect(screen.getByText('Loading profile...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Alex Mercer')).toBeDefined();
    });

    expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    expect(screen.getByDisplayValue('Staff Distributed Systems Engineer')).toBeDefined();
    expect(screen.getByDisplayValue('alex@mercer.dev')).toBeDefined();
    expect(screen.getByText('Form Editor')).toBeDefined();
    expect(screen.getByText('Raw JSON')).toBeDefined();
  });

  it('switches to Raw JSON tab and reflects live edits back to Form Editor', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    // Switch to Raw JSON tab
    fireEvent.click(screen.getByText('Raw JSON'));

    // Should find textarea with JSON content
    expect(screen.getByDisplayValue(/"name":\s*"Alex Mercer"/)).toBeDefined();

    // Edit JSON content
    const updatedJson = {
      ...mockResume.resume,
      basics: {
        ...mockResume.resume.basics,
        name: 'Alexandra Mercer',
      },
    };
    fireEvent.change(screen.getByLabelText('Raw JSON Schema Content'), {
      target: { value: JSON.stringify(updatedJson, null, 2) },
    });

    // Switch back to Form Editor tab
    fireEvent.click(screen.getByText('Form Editor'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alexandra Mercer')).toBeDefined();
    });
  });

  it('patches existing resume when Save Changes is clicked', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    const patchSpy = vi.spyOn(api, 'patchResume').mockResolvedValue({
      ...mockResume,
      title: 'Principal Architect',
    });

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    // Edit Title
    const titleInput = screen.getByPlaceholderText('e.g. Senior Backend Engineer');
    fireEvent.change(titleInput, { target: { value: 'Principal Architect' } });

    // Click Save Changes
    const saveBtn = screen.getAllByText('Save Changes')[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        'resume-1',
        expect.objectContaining({
          title: 'Principal Architect',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Resume updated in-place successfully!')).toBeDefined();
    });
  });

  it('uploads a new resume when Save as New Profile is clicked', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    const uploadSpy = vi.spyOn(api, 'uploadResume').mockResolvedValue({
      ...mockResume,
      id: 'resume-2',
      title: 'New Forked Profile',
      isActive: true,
    });

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    const newBtn = screen.getByText('Save as New Profile');
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          setActive: true,
        })
      );
    });
  });

  it('adds skill tags and bullets inside form editor', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    // Add bullet
    const bulletInput = screen.getByPlaceholderText(/Add achievement bullet/i);
    fireEvent.change(bulletInput, { target: { value: 'Scaled microservices to 10k RPS.' } });

    const addBulletBtn = screen.getByText('Add Bullet');
    fireEvent.click(addBulletBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Scaled microservices to 10k RPS.')).toBeDefined();
    });

    // Add skill tag
    const skillInput = screen.getByPlaceholderText('+ Add skill tag');
    fireEvent.change(skillInput, { target: { value: 'Kubernetes' } });

    const addSkillBtn = screen.getByText('Add');
    fireEvent.click(addSkillBtn);

    await waitFor(() => {
      expect(screen.getByText('Kubernetes')).toBeDefined();
    });
  });
});
