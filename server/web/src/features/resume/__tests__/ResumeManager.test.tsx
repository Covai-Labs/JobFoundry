import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResumeManager } from '../ResumeManager';
import { api, UserResume, SystemSettingsResponse } from '../../../api/client';

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
    expect(screen.getByRole('button', { name: /theme preview/i })).toBeDefined();
  });

  it('switches to Theme Preview tab and displays theme gallery when resume is valid', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    vi.spyOn(api, 'getSettings').mockResolvedValue({
      settings: { tailor_theme: 'jsonresume-theme-jake-technical' },
      meta: {},
    } as unknown as SystemSettingsResponse);
    const previewSpy = vi
      .spyOn(api, 'getMasterResumePreviewPdf')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByText('Alex Mercer')).toBeDefined();
    });

    const previewTab = screen.getByRole('button', { name: /theme preview/i });
    fireEvent.click(previewTab);

    await waitFor(() => {
      expect(screen.getByText('Resume Themes')).toBeDefined();
    });

    // The preview is fetched with credentials and sends the in-editor draft,
    // not the saved resume record.
    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith(
        'jsonresume-theme-jake-technical',
        expect.objectContaining({ basics: expect.objectContaining({ name: 'Alex Mercer' }) })
      );
    });

    await waitFor(() => {
      expect(screen.getByTitle(/Jake Technical Resume Preview/i)).toBeDefined();
    });
  });

  it('shows a retryable error when the preview render fails', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    vi.spyOn(api, 'getSettings').mockResolvedValue({
      settings: { tailor_theme: 'jsonresume-theme-folio' },
      meta: {},
    } as unknown as SystemSettingsResponse);
    vi.spyOn(api, 'getMasterResumePreviewPdf').mockRejectedValue(
      new Error('Failed to render the preview for jsonresume-theme-folio')
    );

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByText('Alex Mercer')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /theme preview/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
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

  it('opens AI Resume Converter modal, parses resume text, reviews extracted entities, and applies to active profile', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    const mockParsedResume = {
      basics: {
        name: 'Jordan Lee',
        label: 'Senior ML Engineer',
        email: 'jordan@example.com',
        phone: '+1 555-0144',
        summary: 'Experienced ML engineer building distributed models.',
        location: { city: 'San Francisco', countryCode: 'US' },
      },
      work: [
        {
          name: 'AI Labs',
          position: 'ML Engineer',
          startDate: '2022-01-01',
          endDate: 'Present',
        },
      ],
      education: [
        {
          institution: 'Stanford University',
          studyType: 'M.S.',
          area: 'Computer Science',
        },
      ],
      skills: [{ name: 'ML/AI', keywords: ['PyTorch', 'TensorFlow', 'LLMs'] }],
      projects: [{ name: 'LLM Evaluator', description: 'Evaluation benchmark' }],
    };

    const parseSpy = vi.spyOn(api, 'parseResumeRaw').mockResolvedValue({
      ok: true,
      resumeJson: mockParsedResume,
    });

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    // Click "AI Convert Raw Resume" button
    const openConverterBtn = screen.getByRole('button', { name: /AI Convert Raw Resume/i });
    fireEvent.click(openConverterBtn);

    // Modal should be open showing input and dropzone
    expect(screen.getByText(/Drag & drop/i)).toBeDefined();
    const textarea = screen.getByPlaceholderText(/Paste your resume contents here/i);
    expect(textarea).toBeDefined();

    // Paste resume text
    fireEvent.change(textarea, {
      target: {
        value:
          'Jordan Lee - Senior ML Engineer\njordan@example.com\nWorked at AI Labs as ML Engineer.',
      },
    });

    // Click "Parse & Convert to JSON"
    const convertBtn = screen.getByRole('button', { name: /Parse & Convert to JSON/i });
    fireEvent.click(convertBtn);

    expect(parseSpy).toHaveBeenCalledWith({
      text: 'Jordan Lee - Senior ML Engineer\njordan@example.com\nWorked at AI Labs as ML Engineer.',
    });

    // Review step should appear with extracted summary & badges
    await waitFor(() => {
      expect(screen.getByText('Review Converted Resume')).toBeDefined();
    });

    expect(screen.getByText('Jordan Lee')).toBeDefined();
    expect(screen.getByText('Senior ML Engineer')).toBeDefined();
    expect(screen.getByText('Work Roles')).toBeDefined();
    expect(screen.getByText('ML/AI')).toBeDefined();

    // Toggle raw JSON inspector
    const inspectJsonBtn = screen.getByRole('button', { name: /Inspect Raw JSON Output/i });
    fireEvent.click(inspectJsonBtn);
    expect(screen.getByText(/Hide Raw JSON/i)).toBeDefined();

    // Click "Apply to Active Profile"
    const applyBtn = screen.getByRole('button', { name: /Apply to Active Profile/i });
    fireEvent.click(applyBtn);

    // Form editor should now have Jordan Lee
    await waitFor(() => {
      expect(screen.getByDisplayValue('Jordan Lee')).toBeDefined();
    });
    expect(screen.getByDisplayValue('Senior ML Engineer')).toBeDefined();
    expect(
      screen.getByText(
        'Converted resume applied to editor! Review your sections and click Save Changes to persist.'
      )
    ).toBeDefined();
  });

  it('allows saving converted resume directly as a new profile', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    const mockParsedResume = {
      basics: {
        name: 'Samantha Ray',
        label: 'DevOps Specialist',
      },
      work: [],
      education: [],
      skills: [],
    };

    vi.spyOn(api, 'parseResumeRaw').mockResolvedValue({
      ok: true,
      resumeJson: mockParsedResume,
    });

    const uploadSpy = vi.spyOn(api, 'uploadResume').mockResolvedValue({
      id: 'resume-samantha',
      userId: 'user-1',
      title: 'Samantha Ray Resume',
      resume: mockParsedResume,
      isActive: true,
      createdAt: 2000,
      updatedAt: 2000,
    });

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Convert Raw Resume/i }));

    const textarea = screen.getByPlaceholderText(/Paste your resume contents here/i);
    fireEvent.change(textarea, {
      target: { value: 'Samantha Ray - DevOps Specialist' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Parse & Convert to JSON/i }));

    await waitFor(() => {
      expect(screen.getByText('Review Converted Resume')).toBeDefined();
    });

    // Click "Save as New Profile" in review modal
    const saveNewBtns = screen.getAllByRole('button', { name: /Save as New Profile/i });
    fireEvent.click(saveNewBtns[saveNewBtns.length - 1]);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Samantha Ray Resume',
          setActive: true,
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Saved and set "Samantha Ray Resume" as your active master profile!')
      ).toBeDefined();
    });
  });

  it('dismisses alert banner when dismiss button is clicked', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);
    vi.spyOn(api, 'patchResume').mockResolvedValue({
      ...mockResume,
      title: 'Updated Title',
    });

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    const saveBtn = screen.getAllByText('Save Changes')[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText('Resume updated in-place successfully!')).toBeDefined();
    });

    // Dismiss banner
    const dismissBtn = screen.getByTitle('Dismiss');
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('validates uploaded JSON file against schema and displays error if invalid', async () => {
    vi.spyOn(api, 'getResumes').mockResolvedValue([mockResume]);

    render(<ResumeManager />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Mercer')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /AI Convert Raw Resume/i }));

    const fileInputs = document.querySelectorAll('input[type="file"][accept*=".json"]');
    const converterFileInput = fileInputs[fileInputs.length - 1] as HTMLInputElement;
    expect(converterFileInput).toBeDefined();

    const invalidJsonFile = new File(['{"basics": {"email": "not-an-email"}}'], 'invalid.json', {
      type: 'application/json',
    });

    fireEvent.change(converterFileInput, { target: { files: [invalidJsonFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON Resume schema/i)).toBeDefined();
    });
  });
});
