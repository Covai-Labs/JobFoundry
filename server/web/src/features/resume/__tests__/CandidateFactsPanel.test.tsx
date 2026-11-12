import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CandidateFactsPanel } from '../CandidateFactsPanel';
import { api, UserFact } from '../../../api/client';

const mockFacts: UserFact[] = [
  {
    id: 'fact-1',
    userId: 'user-1',
    category: 'preference',
    factText: 'Remote-first, UTC+5:30 timezone',
    isActive: true,
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 'fact-2',
    userId: 'user-1',
    category: 'constraint',
    factText: '60 days notice period',
    isActive: false,
    createdAt: 1000,
    updatedAt: 1000,
  },
];

describe('CandidateFactsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders facts list with category badges and active count', async () => {
    vi.spyOn(api, 'getFacts').mockResolvedValue(mockFacts);

    render(<CandidateFactsPanel />);

    expect(screen.getByText('Loading context facts...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Remote-first, UTC+5:30 timezone')).toBeDefined();
    });

    expect(screen.getByText('60 days notice period')).toBeDefined();
    expect(screen.getByText(/1 Active Context Facts/)).toBeDefined();
  });

  it('submits a new fact and appends to the list', async () => {
    vi.spyOn(api, 'getFacts').mockResolvedValue([]);
    const createdFact: UserFact = {
      id: 'fact-3',
      userId: 'user-1',
      category: 'compensation',
      factText: 'Minimum base $180k',
      isActive: true,
      createdAt: 2000,
      updatedAt: 2000,
    };
    const createSpy = vi.spyOn(api, 'createFact').mockResolvedValue(createdFact);

    render(<CandidateFactsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/No private context facts recorded yet/)).toBeDefined();
    });

    const input = screen.getByPlaceholderText(/e\.g\. Remote-first/i);
    fireEvent.change(input, { target: { value: 'Minimum base $180k' } });

    const submitBtn = screen.getByText('Add Context Fact');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        category: 'preference',
        factText: 'Minimum base $180k',
        isActive: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Minimum base $180k')).toBeDefined();
    });
  });

  it('toggles active status of an existing fact', async () => {
    vi.spyOn(api, 'getFacts').mockResolvedValue(mockFacts);
    const patchSpy = vi.spyOn(api, 'patchFact').mockResolvedValue({
      ...mockFacts[0],
      isActive: false,
    });

    render(<CandidateFactsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Remote-first, UTC+5:30 timezone')).toBeDefined();
    });

    const activeToggle = screen.getByText('Active');
    fireEvent.click(activeToggle);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('fact-1', { isActive: false });
    });
  });

  it('deletes a fact on trash button click', async () => {
    vi.spyOn(api, 'getFacts').mockResolvedValue(mockFacts);
    const deleteSpy = vi.spyOn(api, 'deleteFact').mockResolvedValue(true);

    render(<CandidateFactsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Remote-first, UTC+5:30 timezone')).toBeDefined();
    });

    const deleteButtons = screen.getAllByTitle('Delete fact');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('fact-1');
    });
  });
});
