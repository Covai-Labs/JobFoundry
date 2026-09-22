import React from 'react';
import { Job, JobStatus } from '../../types/job';
import { JobDetail } from '../detail/JobDetail';

interface JobWorkbenchProps {
  job: Job | null;
  threshold?: number;
  onStatusChange: (jobId: string, newStatus: JobStatus) => void;
  onJobUpdated: (updatedJob: Job) => void;
  onDeleteJob?: (jobId: string) => void;
}

/**
 * Split-view inline pane. All detail logic lives in JobDetail;
 * this shell only preserves the workbench mount point (CSS + props).
 */
export const JobWorkbench: React.FC<JobWorkbenchProps> = (props) => {
  return <JobDetail {...props} />;
};
