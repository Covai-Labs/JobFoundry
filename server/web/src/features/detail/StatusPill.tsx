import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { JobStatus } from '../../types/job';
import { CLOSED_STATUSES, PIPELINE_STATUSES, STATUS_LABELS } from '../../lib/jobStages';
import { Popover } from '../../components/Popover';

interface StatusPillProps {
  status: JobStatus;
  onChange: (next: JobStatus) => void;
}

interface StageOptionProps {
  status: JobStatus;
  current: boolean;
  onSelect: () => void;
}

const StageOption: React.FC<StageOptionProps> = ({ status, current, onSelect }) => (
  <button
    type="button"
    role="option"
    aria-selected={current}
    data-stage={status}
    className={`stage-menu-item ${current ? 'is-current' : ''}`}
    onClick={onSelect}
  >
    <span className="stage-dot" aria-hidden="true" />
    <span className="stage-menu-item-label">{STATUS_LABELS[status]}</span>
    {current && <Check size={13} aria-hidden="true" />}
  </button>
);

/**
 * Labelled stage control. Reads as state ("Stage: Tailored") and opens the
 * full pipeline in groups, instead of pretending to be another action button.
 */
export const StatusPill: React.FC<StatusPillProps> = ({ status, onChange }) => (
  <Popover
    align="start"
    className="stage-pill-popover"
    trigger={({ open, toggle }) => (
      <button
        type="button"
        className={`stage-pill ${open ? 'is-open' : ''}`}
        data-stage={status}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Pipeline stage: ${STATUS_LABELS[status]}. Change stage`}
        title="Change pipeline stage"
        onClick={toggle}
      >
        <span className="stage-dot" aria-hidden="true" />
        <span className="stage-pill-label">Stage</span>
        <span className="stage-pill-value">{STATUS_LABELS[status]}</span>
        <ChevronDown size={12} className="stage-pill-caret" aria-hidden="true" />
      </button>
    )}
  >
    {(close) => (
      <div className="stage-menu" role="listbox" aria-label="Pipeline stage">
        <div className="stage-menu-heading">Pipeline</div>
        {PIPELINE_STATUSES.map((option) => (
          <StageOption
            key={option}
            status={option}
            current={option === status}
            onSelect={() => {
              close();
              if (option !== status) onChange(option);
            }}
          />
        ))}

        <div className="stage-menu-separator" role="presentation" />
        <div className="stage-menu-heading">Closed &amp; system</div>
        {CLOSED_STATUSES.map((option) => (
          <StageOption
            key={option}
            status={option}
            current={option === status}
            onSelect={() => {
              close();
              if (option !== status) onChange(option);
            }}
          />
        ))}
      </div>
    )}
  </Popover>
);
