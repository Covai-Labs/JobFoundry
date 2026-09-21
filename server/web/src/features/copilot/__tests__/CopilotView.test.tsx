import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopilotView } from '../CopilotView';
import { api } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  api: {
    getCopilotData: vi.fn(),
    generateCopilotOutreach: vi.fn(),
    generateCopilotQA: vi.fn(),
    generateCopilotCoverLetter: vi.fn(),
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
});
