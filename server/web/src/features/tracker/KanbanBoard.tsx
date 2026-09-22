import React, { useCallback, useEffect, useState } from 'react';
import { Job, JobStatus } from '../../types/job';
import {
  KANBAN_COLUMNS,
  KANBAN_SWATCHES,
  KanbanPrefs,
  isMoveAllowed,
  loadKanbanPrefs,
  saveKanbanPrefs,
} from './trackerUtils';
import { getScoreCategory } from '../filters/filterUtils';

interface KanbanBoardProps {
  jobs: Job[];
  threshold?: number;
  selectedJobId?: string;
  onSelectJob: (job: Job) => void;
  onStatusChange: (jobId: string, newStatus: JobStatus) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  jobs,
  threshold = 75,
  selectedJobId,
  onSelectJob,
  onStatusChange,
}) => {
  const [prefs, setPrefs] = useState<KanbanPrefs>(loadKanbanPrefs);
  const [openMenu, setOpenMenu] = useState<JobStatus | null>(null);
  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) : undefined;
  const selectedColumnId =
    selectedJob?.status === 'rejected_by_score' ? 'rejected' : selectedJob?.status;
  const effectiveHiddenColumns = prefs.hiddenColumns.filter(
    (columnId) => columnId !== selectedColumnId
  );

  useEffect(() => {
    saveKanbanPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (openMenu === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openMenu]);

  const toggleHidden = useCallback(
    (status: JobStatus) => {
      setPrefs((prev) => {
        if (status === selectedColumnId) {
          return prev;
        }
        const hidden = prev.hiddenColumns.includes(status)
          ? prev.hiddenColumns.filter((s) => s !== status)
          : [...prev.hiddenColumns, status];
        return { ...prev, hiddenColumns: hidden };
      });
    },
    [selectedColumnId]
  );

  const setAccent = useCallback((status: JobStatus, cssVar: string) => {
    setPrefs((prev) => {
      const colors = cssVar ? { ...prev.columnColors, [status]: cssVar } : { ...prev.columnColors };
      if (!cssVar) {
        delete colors[status];
      }
      return { ...prev, columnColors: colors };
    });
  }, []);

  const restoreColumn = useCallback((status: JobStatus) => {
    setPrefs((prev) => ({
      ...prev,
      hiddenColumns: prev.hiddenColumns.filter((s) => s !== status),
    }));
  }, []);

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('text/plain', jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: JobStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    if (isMoveAllowed(job.status, targetStatus)) {
      onStatusChange(jobId, targetStatus);
    }
  };

  return (
    <div className="kanban-board">
      {prefs.hiddenColumns.length > 0 && (
        <div className="kanban-hiddenbar" aria-label="Hidden columns">
          <span className="kanban-hiddenbar-label">Hidden:</span>
          {prefs.hiddenColumns.map((id) => {
            const col = KANBAN_COLUMNS.find((c) => c.id === id);
            return (
              <button
                key={id}
                type="button"
                className="kanban-hiddenbar-chip"
                onClick={() => restoreColumn(id)}
                aria-label={`Show ${col?.title ?? id} column`}
                title={`Show ${col?.title ?? id} column`}
              >
                {col?.title ?? id}
                <span aria-hidden="true">＋</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="kanban-columns"
        style={
          {
            '--kanban-column-count': KANBAN_COLUMNS.filter(
              (c) => !effectiveHiddenColumns.includes(c.id)
            ).length,
          } as React.CSSProperties
        }
      >
        {KANBAN_COLUMNS.map((column) => {
          if (effectiveHiddenColumns.includes(column.id)) {
            return null;
          }

          const columnJobs = jobs.filter((j) => {
            if (column.id === 'rejected') {
              return j.status === 'rejected' || j.status === 'rejected_by_score';
            }
            return j.status === column.id;
          });

          const accentVar = prefs.columnColors[column.id];
          const columnStyle: React.CSSProperties = accentVar
            ? {
                borderTopWidth: '3px',
                borderTopStyle: 'solid',
                borderTopColor: `var(${accentVar})`,
              }
            : {};
          const headerStyle: React.CSSProperties = accentVar
            ? { background: `color-mix(in srgb, var(${accentVar}) 14%, transparent)` }
            : {};
          const menuOpen = openMenu === column.id;

          return (
            <div
              key={column.id}
              className="kanban-column"
              style={columnStyle}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="kanban-column-header" style={headerStyle}>
                <div className="kanban-column-title">
                  <span className={`badge ${column.badgeClass}`}>{column.title}</span>
                </div>
                <div className="kanban-column-actions">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {columnJobs.length}
                  </span>
                  <button
                    type="button"
                    className="kanban-kebab"
                    aria-label={`Column options for ${column.title}`}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    onClick={() => setOpenMenu(menuOpen ? null : column.id)}
                  >
                    ⋯
                  </button>
                </div>
                {menuOpen && (
                  <>
                    <div
                      className="kanban-colmenu-backdrop"
                      onClick={() => setOpenMenu(null)}
                      aria-hidden="true"
                    />
                    <div
                      className="kanban-colmenu"
                      role="menu"
                      aria-label={`${column.title} column options`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="kanban-colmenu-item"
                        disabled={column.id === selectedColumnId}
                        title={
                          column.id === selectedColumnId
                            ? 'Cannot hide the selected job column'
                            : undefined
                        }
                        onClick={() => {
                          toggleHidden(column.id);
                          setOpenMenu(null);
                        }}
                      >
                        Hide column
                      </button>
                      <div
                        className="kanban-colmenu-swatches"
                        role="group"
                        aria-label={`${column.title} accent color`}
                      >
                        {KANBAN_SWATCHES.map((swatch) => (
                          <button
                            key={swatch.name}
                            type="button"
                            className={`kanban-colmenu-swatch ${accentVar === swatch.cssVar ? 'is-active' : ''}`}
                            style={{ backgroundColor: `var(${swatch.cssVar})` }}
                            title={swatch.name}
                            aria-label={`Set ${column.title} accent to ${swatch.name}`}
                            onClick={() => {
                              setAccent(column.id, swatch.cssVar);
                              setOpenMenu(null);
                            }}
                          />
                        ))}
                        <button
                          type="button"
                          className="kanban-colmenu-swatch kanban-colmenu-reset"
                          title="Reset to default accent"
                          aria-label={`Reset ${column.title} accent to default`}
                          disabled={!accentVar}
                          onClick={() => {
                            setAccent(column.id, '');
                            setOpenMenu(null);
                          }}
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="kanban-cards-list">
                {columnJobs.map((job) => {
                  const scoreCat = getScoreCategory(job.fit_score, threshold);
                  return (
                    <div
                      key={job.id}
                      className="kanban-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      onClick={() => onSelectJob(job)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3 }}>
                          {job.title}
                        </div>
                        {job.fit_score !== null && job.fit_score !== undefined && (
                          <span
                            className={`score-badge score-${scoreCat}`}
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                          >
                            {job.fit_score}%
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                        {job.company}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
