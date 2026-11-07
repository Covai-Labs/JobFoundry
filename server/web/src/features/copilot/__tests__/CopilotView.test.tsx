import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopilotView, buildCoverLetterPrintDocument } from '../CopilotView';
import { api } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  api: {
    getCopilotData: vi.fn(),
    generateCopilotOutreach: vi.fn(),
    generateCopilotQA: vi.fn(),
    generateCopilotCoverLetter: vi.fn(),
    getActiveResume: vi.fn(),
  },
}));

describe('CopilotView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders initial state and fetches existing copilot data', async () => {
    vi.mocked(api.getCopilotData).mockResolvedValue({
      ok: true,
      data: {
        outreach: {
          connection_note:
            'Hi Alex, saw CloudCorp is hiring Staff Distributed Systems Engineers. Led multi-region Kafka migrations.',
          connection_note_char_count: 104,
          connection_note_tier_fits: {
            free_200: true,
            premium_300: true,
          },
          inmail_subject: 'Staff Distributed Systems Engineer - Track Record at Scale',
          inmail_body: 'Hi Alex,\n\nI noticed the opening at CloudCorp.',
          persona_used: 'recruiter',
          matched_projects: ['Global Kafka Pipeline', 'Cassandra High-Throughput Service'],
        },
        qa_history: [],
        cover_letter: null,
      },
    });

    render(<CopilotView jobId="job-copilot-1" jobTitle="Staff Engineer" company="CloudCorp" />);

    expect(screen.getByText(/Application & Outreach Copilot/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Grounded in your active Master Resume for Staff Engineer at CloudCorp/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/LinkedIn Connection Note/i)).toBeInTheDocument();
      expect(screen.getByText(/Free Tier \(<200\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Global Kafka Pipeline/i)).toBeInTheDocument();
    });
  });

  it('switches to Screening Q&A tab and generates grounded answer', async () => {
    vi.mocked(api.getCopilotData).mockResolvedValue({
      ok: true,
      data: {
        outreach: null,
        qa_history: [],
        cover_letter: null,
      },
    });

    vi.mocked(api.generateCopilotQA).mockResolvedValue({
      ok: true,
      qa: {
        question: 'Describe a time you handled an outage.',
        answer:
          'During a critical Kafka cluster failure, I led the failover across regions within 4 minutes.',
        star_structure: {
          situation: 'Underlying network partition disconnected primary broker.',
          task: 'Restore partition consumer offsets without data corruption.',
          action: 'Rerouted consumer traffic to backup replica pool.',
          result: 'Zero message loss and recovered SLA in 4 minutes.',
        },
        matched_evidence: ['Kafka Pipeline Outage Remediation', 'Disaster Recovery Plan'],
      },
    });

    render(<CopilotView jobId="job-copilot-1" jobTitle="Staff Engineer" company="CloudCorp" />);

    const qaTabBtn = screen.getByRole('button', { name: /Screening Q&A Assistant/i });
    fireEvent.click(qaTabBtn);

    expect(
      screen.getByPlaceholderText(/Paste any question from the application form/i)
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Paste any question from the application form/i);
    fireEvent.change(input, { target: { value: 'Describe a time you handled an outage.' } });

    const generateBtn = screen.getByRole('button', { name: /Generate Grounded Answer/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.generateCopilotQA).toHaveBeenCalledWith(
        'job-copilot-1',
        'Describe a time you handled an outage.'
      );
      expect(
        screen.getByText(/Zero message loss and recovered SLA in 4 minutes/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Kafka Pipeline Outage Remediation/i)).toBeInTheDocument();
    });
  });

  it('switches to Cover Letter tab and generates 3-paragraph letter', async () => {
    vi.mocked(api.getCopilotData).mockResolvedValue({
      ok: true,
      data: {
        outreach: null,
        qa_history: [],
        cover_letter: null,
      },
    });

    vi.mocked(api.generateCopilotCoverLetter).mockResolvedValue({
      ok: true,
      cover_letter: {
        cover_letter:
          'Dear CloudCorp Team,\n\nI am writing to express my interest...\n\nIn my previous role, I designed scalable distributed queues...\n\nI would welcome the opportunity to discuss further.',
        word_count: 215,
        paragraph_breakdown: {
          hook: 'Targeting high-scale infrastructure at CloudCorp.',
          evidence: 'Architected distributed systems handling 50k req/sec.',
          alignment: 'Excited to bring deep distributed systems skills to the team.',
        },
        highlighted_skills: ['Distributed Systems', 'Go', 'Kafka'],
      },
    });

    render(<CopilotView jobId="job-copilot-1" jobTitle="Staff Engineer" company="CloudCorp" />);

    await waitFor(() => expect(api.getCopilotData).toHaveBeenCalled());

    const coverLetterTabBtn = screen.getByRole('button', { name: /Tailored Cover Letter/i });
    fireEvent.click(coverLetterTabBtn);

    const generateBtn = await screen.findByRole('button', { name: /Generate Cover Letter/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('215 words')).toBeInTheDocument();
      expect(
        screen.getByText(/Targeting high-scale infrastructure at CloudCorp/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/Distributed Systems/i).length).toBeGreaterThan(0);
    });
  });

  it('renders a print-ready letterhead with candidate details and job metadata', async () => {
    vi.mocked(api.getCopilotData).mockResolvedValue({
      ok: true,
      data: {
        outreach: null,
        qa_history: [],
        cover_letter: {
          cover_letter:
            'Dear CloudCorp Team,\n\nDistributed queues are my craft.\n\nI would welcome the opportunity to discuss further.',
          word_count: 180,
          paragraph_breakdown: {
            hook: 'Targeting high-scale infrastructure at CloudCorp.',
            evidence: 'Architected distributed systems handling 50k req/sec.',
            alignment: 'Excited to bring deep distributed systems skills to the team.',
          },
          highlighted_skills: ['Distributed Systems'],
        },
      },
    });
    vi.mocked(api.getActiveResume).mockResolvedValue({
      id: 'resume-1',
      userId: 'user-1',
      title: 'Master Resume',
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
      resume: {
        basics: {
          name: 'Anu Shah',
          email: 'anu@example.com',
          phone: '+1 555 0100',
          location: { city: 'Bengaluru', region: 'KA', countryCode: 'IN' },
          url: 'https://example.com',
        },
      },
    });

    render(<CopilotView jobId="job-copilot-1" jobTitle="Staff Engineer" company="CloudCorp" />);

    fireEvent.click(await screen.findByRole('button', { name: /Tailored Cover Letter/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Download \/ Print PDF/i }));

    await waitFor(() => expect(api.getActiveResume).toHaveBeenCalled());

    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Cover letter print preview"]'
    );
    expect(frame).toBeTruthy();
    const printed = frame?.contentDocument?.body.textContent || '';
    expect(printed).toContain('Anu Shah');
    expect(printed).toContain('anu@example.com');
    expect(printed).toContain('Bengaluru, KA, IN');
    expect(printed).toContain('Re: Application for Staff Engineer');
    expect(printed).toContain('CloudCorp');
    expect(printed).toContain('Dear CloudCorp Team');
    expect(printed).toContain('Sincerely,');

    // The frame stays mounted until the print dialog reports it has closed.
    frame?.contentWindow?.dispatchEvent(new Event('afterprint'));
    await waitFor(() => {
      expect(document.querySelector('iframe[title="Cover letter print preview"]')).toBeNull();
    });
  });

  it('escapes letterhead fields so resume data cannot inject markup', () => {
    const html = buildCoverLetterPrintDocument({
      body: 'Body with <script>alert(1)</script>',
      basics: { name: 'A & B <Ltd>', email: 'a"b@example.com' },
      jobTitle: 'Engineer <Lead>',
      company: 'Cloud & Co',
      date: new Date('2026-11-07T00:00:00Z'),
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A &amp; B &lt;Ltd&gt;');
    expect(html).toContain('Cloud &amp; Co');
    expect(html).toContain('Re: Application for Engineer &lt;Lead&gt;');
  });
});
