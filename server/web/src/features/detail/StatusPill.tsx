import React, { useCallback, useState } from 'react';
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
    role="menuitemradio"
    aria-checked={current}
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
export const StatusPill: React.FC<StatusPillProps> = ({ status, onChange }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const select = (option: JobStatus) => {
    close();
    if (option !== status) {
      onChange(option);
    }
  };

  return (
    <Popover
      open={open}
      onClose={close}
      align="start"
      className="stage-pill-popover"
      trigger={
        <button
          type="button"
          className={`stage-pill ${open ? 'is-open' : ''}`}
          data-stage={status}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Pipeline stage: ${STATUS_LABELS[status]}. Change stage`}
          title="Change pipeline stage"
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          <span className="stage-dot" aria-hidden="true" />
          <span className="stage-pill-label">Stage</span>
          <span className="stage-pill-value">{STATUS_LABELS[status]}</span>
          <ChevronDown size={12} className="stage-pill-caret" aria-hidden="true" />
        </button>
      }
    >
      <div className="stage-menu" role="menu" aria-label="Pipeline stage">
        <div className="stage-menu-heading">Pipeline</div>
        {PIPELINE_STATUSES.map((option) => (
          <StageOption
            key={option}
            status={option}
            current={option === status}
            onSelect={() => {
              select(option);
            }}
          />
        ))}

        <div className="stage-menu-separator" aria-hidden="true" />
        <div className="stage-menu-heading">Closed &amp; system</div>
        {CLOSED_STATUSES.map((option) => (
          <StageOption
            key={option}
            status={option}
            current={option === status}
            onSelect={() => {
              select(option);
            }}
          />
        ))}
      </div>
    </Popover>
  );
};
