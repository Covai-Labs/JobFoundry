import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Job, JobStatus } from '../../../types/job';
import { KanbanBoard } from '../KanbanBoard';

const baseJob = (status: JobStatus, id = 'job-1'): Job => ({
  id,
  title: `Engineer ${id}`,
  company: 'Acme',
  location: 'Remote',
  url: `https://example.com/${id}`,
  source: 'web',
  liveness: 'active',
  fit_score: 80,
  status,
  created_at: 1700000000000,
  updated_at: 1700000000000,
});

const getColumn = (title: string) =>
  Array.from(document.querySelectorAll('.kanban-column')).find(
    (column) => column.querySelector('.kanban-column-title .badge')?.textContent?.trim() === title
  ) as HTMLElement;

const getDropTarget = (title: string) => getColumn(title);

const dropJob = (target: HTMLElement, jobId: string) => {
  fireEvent.drop(target, {
    dataTransfer: { getData: (type: string) => (type === 'text/plain' ? jobId : '') },
  });
};

const renderBoard = (
  jobs: Job[],
  onStatusChange = vi.fn(),
  onSelectJob = vi.fn(),
  selectedJobId?: string
) =>
  render(
    <KanbanBoard
      jobs={jobs}
      selectedJobId={selectedJobId}
      onSelectJob={onSelectJob}
      onStatusChange={onStatusChange}
    />
  );

describe('KanbanBoard column visibility + accent prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all columns by default', () => {
    renderBoard([baseJob('new')]);
    expect(getColumn('New')).toBeInTheDocument();
    expect(getColumn('Offer')).toBeInTheDocument();
    expect(getColumn('Archived')).toBeInTheDocument();
  });

  it('hides a column when its toggle is clicked and persists to localStorage', () => {
    renderBoard([baseJob('new')]);
    fireEvent.click(screen.getByRole('button', { name: /Hide Offer column/ }));

    expect(getColumn('Offer')).toBeUndefined();
    expect(getColumn('New')).toBeInTheDocument();

    const prefs = JSON.parse(localStorage.getItem('jf_kanban_prefs')!);
    expect(prefs.hiddenColumns).toContain('offer');
  });

  it('shows a hidden column toggle as struck/dimmed (not invisible)', () => {
    renderBoard([baseJob('new')]);
    fireEvent.click(screen.getByRole('button', { name: /Hide Offer column/ }));
    const showBtn = screen.getByRole('button', { name: /Show Offer column/ });
    expect(showBtn).toBeInTheDocument();
    expect(showBtn).not.toBeDisabled();
  });

  it('applies a custom accent color to the column header badge', () => {
    renderBoard([baseJob('new')]);
    fireEvent.click(screen.getByRole('button', { name: /Set New accent to Cyan/ }));

    const badge = screen.getByText('New', { selector: '.kanban-column .badge' });
    expect(badge.getAttribute('style')).toContain('var(--color-cyan)');

    const prefs = JSON.parse(localStorage.getItem('jf_kanban_prefs')!);
    expect(prefs.columnColors.new).toBe('--color-cyan');
  });

  it('resets a custom accent back to the default badge class', () => {
    renderBoard([baseJob('new')]);
    fireEvent.click(screen.getByRole('button', { name: /Set New accent to Cyan/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reset New accent to default/ }));

    const badge = getColumn('New')?.querySelector('.badge') as HTMLElement;
    expect(badge.style.backgroundColor).toBe('');
    expect(badge.className).toContain('badge-blue');
  });

  it('falls back to defaults when localStorage contains corrupt prefs', () => {
    localStorage.setItem('jf_kanban_prefs', '{ not valid json');
    renderBoard([baseJob('new')]);
    expect(getColumn('New')).toBeInTheDocument();
    expect(getColumn('Offer')).toBeInTheDocument();
  });

  it('falls back to defaults when prefs are not an object', () => {
    localStorage.setItem('jf_kanban_prefs', '42');
    renderBoard([baseJob('new')]);
    expect(getColumn('New')).toBeInTheDocument();
  });

  it('filters out non-JobStatus entries from hiddenColumns on load', () => {
    localStorage.setItem(
      'jf_kanban_prefs',
      JSON.stringify({ hiddenColumns: ['offer', 'bogus', 123] })
    );
    renderBoard([baseJob('new')]);
    expect(getColumn('Offer')).toBeUndefined();
    expect(getColumn('New')).toBeInTheDocument();
  });

  it('keeps column counts correct after hiding a column', () => {
    const jobs = [baseJob('new', 'a'), baseJob('new', 'b'), baseJob('offer', 'c')];
    renderBoard(jobs);
    expect(getColumn('New')?.textContent).toContain('2');
    fireEvent.click(screen.getByRole('button', { name: /Hide New column/ }));
    expect(getColumn('New')).toBeUndefined();
  });

  it('still fires onStatusChange with the right status on drop', () => {
    const onStatusChange = vi.fn();
    const jobs = [baseJob('new', 'job-1')];
    renderBoard(jobs, onStatusChange);

    dropJob(getDropTarget('Saved'), 'job-1');

    expect(onStatusChange).toHaveBeenCalledWith('job-1', 'saved');
  });

  it('still fires onStatusChange with the right status on drop', () => {
    const onStatusChange = vi.fn();
    const jobs = [baseJob('new', 'job-1')];
    renderBoard(jobs, onStatusChange);

    dropJob(getDropTarget('Rejected'), 'job-1');

    expect(onStatusChange).toHaveBeenCalledWith('job-1', 'rejected');
  });

  it('does not allow hiding the column containing the selected job', () => {
    renderBoard([baseJob('new', 'job-1')], vi.fn(), vi.fn(), 'job-1');
    const hideButton = screen.getByRole('button', { name: /Hide New column/ });
    expect(hideButton).toBeDisabled();
    fireEvent.click(hideButton);
    expect(getColumn('New')).toBeInTheDocument();
  });
});
