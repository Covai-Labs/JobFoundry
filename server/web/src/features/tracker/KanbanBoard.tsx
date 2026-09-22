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
  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) : undefined;
  const selectedColumnId = selectedJob?.status;

  useEffect(() => {
    saveKanbanPrefs(prefs);
  }, [prefs]);

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
      <div className="kanban-prefs" role="toolbar" aria-label="Kanban column preferences">
        {KANBAN_COLUMNS.map((column) => {
          const hidden = prefs.hiddenColumns.includes(column.id);
          const accentVar = prefs.columnColors[column.id];
          return (
            <div
              key={column.id}
              className={`kanban-prefs-item ${hidden ? 'is-hidden' : ''}`}
              data-column-id={column.id}
            >
              <span
                className="kanban-prefs-dot"
                style={{ backgroundColor: accentVar ? `var(${accentVar})` : undefined }}
                aria-hidden
              />
              <span className="kanban-prefs-label">{column.title}</span>
              <button
                type="button"
                className="kanban-prefs-toggle"
                aria-pressed={!hidden}
                aria-label={`${hidden ? 'Show' : 'Hide'} ${column.title} column`}
                disabled={column.id === selectedColumnId}
                title={
                  column.id === selectedColumnId ? 'Cannot hide the selected job column' : undefined
                }
                onClick={() => toggleHidden(column.id)}
              >
                {hidden ? 'Show' : 'Hide'}
              </button>
              <span
                className="kanban-prefs-swatch-group"
                role="group"
                aria-label={`${column.title} accent color`}
              >
                {KANBAN_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    className={`kanban-prefs-swatch ${accentVar === swatch.cssVar ? 'is-active' : ''}`}
                    style={{ backgroundColor: `var(${swatch.cssVar})` }}
                    title={swatch.name}
                    aria-label={`Set ${column.title} accent to ${swatch.name}`}
                    onClick={() => setAccent(column.id, swatch.cssVar)}
                  />
                ))}
                <button
                  type="button"
                  className="kanban-prefs-swatch kanban-prefs-reset"
                  title="Reset to default accent"
                  aria-label={`Reset ${column.title} accent to default`}
                  disabled={!accentVar}
                  onClick={() => setAccent(column.id, '')}
                >
                  ↺
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="kanban-columns"
        style={
          {
            '--kanban-column-count': KANBAN_COLUMNS.filter(
              (c) => !prefs.hiddenColumns.includes(c.id)
            ).length,
          } as React.CSSProperties
        }
      >
        {KANBAN_COLUMNS.map((column) => {
          if (prefs.hiddenColumns.includes(column.id)) {
            return null;
          }

          const columnJobs = jobs.filter((j) => {
            if (column.id === 'rejected') {
              return j.status === 'rejected' || j.status === 'rejected_by_score';
            }
            return j.status === column.id;
          });

          const accentVar = prefs.columnColors[column.id];
          const badgeStyle: React.CSSProperties = accentVar
            ? { backgroundColor: `var(${accentVar})` }
            : {};

          return (
            <div
              key={column.id}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="kanban-column-header">
                <div className="kanban-column-title">
                  <span className={`badge ${column.badgeClass}`} style={badgeStyle}>
                    {column.title}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {columnJobs.length}
                </span>
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
