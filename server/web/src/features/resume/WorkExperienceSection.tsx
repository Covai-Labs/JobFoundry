/* eslint-disable no-unused-vars */
import React from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { WorkItem } from './resumeTypes';
import { CollapsibleSection } from './CollapsibleSection';
import { WorkExperienceItem, WorkField } from './WorkExperienceItem';

export interface WorkExperienceSectionProps {
  work: WorkItem[];
  isOpen: boolean;
  onToggle: () => void;
  onAddWork: () => void;
  onUpdateWork: (index: number, field: WorkField, val: string) => void;
  onRemoveWork: (index: number) => void;
  onAddHighlight: (workIndex: number, text: string) => void;
  onUpdateHighlight: (workIndex: number, highlightIndex: number, text: string) => void;
  onRemoveHighlight: (workIndex: number, highlightIndex: number) => void;
}

export const WorkExperienceSection: React.FC<WorkExperienceSectionProps> = ({
  work,
  isOpen,
  onToggle,
  onAddWork,
  onUpdateWork,
  onRemoveWork,
  onAddHighlight,
  onUpdateHighlight,
  onRemoveHighlight,
}) => (
  <CollapsibleSection
    id="work"
    title="Work Experience"
    countBadge={`${work.length} roles`}
    icon={<Briefcase size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
    isOpen={isOpen}
    onToggle={onToggle}
  >
    {work.map((w, wIdx: number) => (
      <WorkExperienceItem
        key={wIdx}
        work={w}
        workIndex={wIdx}
        onUpdate={(field, val) => {
          onUpdateWork(wIdx, field, val);
        }}
        onRemove={() => {
          onRemoveWork(wIdx);
        }}
        onAddHighlight={(text) => {
          onAddHighlight(wIdx, text);
        }}
        onUpdateHighlight={(hIdx, text) => {
          onUpdateHighlight(wIdx, hIdx, text);
        }}
        onRemoveHighlight={(hIdx) => {
          onRemoveHighlight(wIdx, hIdx);
        }}
      />
    ))}

    <button
      type="button"
      onClick={onAddWork}
      className="btn btn-secondary btn-sm"
      style={{
        alignSelf: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      <Plus size={14} /> Add Role Experience
    </button>
  </CollapsibleSection>
);
