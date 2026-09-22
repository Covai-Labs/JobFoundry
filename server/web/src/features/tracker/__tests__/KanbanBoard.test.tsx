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

const openColumnMenu = (title: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Column options for ${title}` }));
};

const hideColumn = (title: string) => {
  openColumnMenu(title);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Hide column' }));
};

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

  it('hides a column from its header menu and persists to localStorage', () => {
    renderBoard([baseJob('new')]);
    hideColumn('Offer');

    expect(getColumn('Offer')).toBeUndefined();
    expect(getColumn('New')).toBeInTheDocument();

    const prefs = JSON.parse(localStorage.getItem('jf_kanban_prefs')!);
    expect(prefs.hiddenColumns).toContain('offer');
  });

  it('shows a hidden column as a restore chip that brings it back', () => {
    renderBoard([baseJob('new')]);
    hideColumn('Offer');

    const chip = screen.getByRole('button', { name: /Show Offer column/ });
    expect(chip).toBeInTheDocument();

    fireEvent.click(chip);
    expect(getColumn('Offer')).toBeInTheDocument();
  });

  it('paints the column chrome with the chosen accent color', () => {
    renderBoard([baseJob('new')]);
    openColumnMenu('New');
    fireEvent.click(screen.getByRole('button', { name: /Set New accent to Cyan/ }));

    const column = getColumn('New');
    expect(column?.style.borderTopColor).toContain('--color-cyan');

    const prefs = JSON.parse(localStorage.getItem('jf_kanban_prefs')!);
    expect(prefs.columnColors.new).toBe('--color-cyan');
  });

  it('resets a custom accent back to the default column chrome', () => {
    renderBoard([baseJob('new')]);
    openColumnMenu('New');
    fireEvent.click(screen.getByRole('button', { name: /Set New accent to Cyan/ }));
    openColumnMenu('New');
    fireEvent.click(screen.getByRole('button', { name: /Reset New accent to default/ }));

    const column = getColumn('New') as HTMLElement;
    expect(column.style.borderTopColor).toBe('');
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
    hideColumn('New');
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
    openColumnMenu('New');
    const hideItem = screen.getByRole('menuitem', { name: 'Hide column' });
    expect(hideItem).toBeDisabled();
    fireEvent.click(hideItem);
    expect(getColumn('New')).toBeInTheDocument();
  });
});
