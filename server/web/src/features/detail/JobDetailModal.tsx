import React from 'react';
import { Job, JobStatus } from '../../types/job';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { JobDetail } from './JobDetail';

interface JobDetailModalProps {
  job: Job | null;
  threshold?: number;
  onClose: () => void;
  onStatusChange: (jobId: string, newStatus: JobStatus) => void;
  onJobUpdated: (updatedJob: Job) => void;
  onDeleteJob?: (jobId: string) => void;
}

/**
 * Modal shell over the shared JobDetail core (used by /jobs/:id from
 * feed grid, tracker, and pipeline). All detail logic lives in JobDetail;
 * this shell only owns overlay chrome: backdrop, close, error boundary.
 */
export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  threshold = 75,
  onClose,
  onStatusChange,
  onJobUpdated,
  onDeleteJob,
}) => {
  if (!job) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        <ErrorBoundary fallbackTitle="Job Details Rendering Error">
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            aria-label="Close job details"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              borderRadius: 'var(--radius-full)',
              width: '32px',
              height: '32px',
              padding: 0,
            }}
          >
            ✕
          </button>
          <JobDetail
            job={job}
            threshold={threshold}
            onStatusChange={onStatusChange}
            onJobUpdated={onJobUpdated}
            onDeleteJob={onDeleteJob}
            onClose={onClose}
          />
          <div
            className="modal-footer"
            style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
          >
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
};
