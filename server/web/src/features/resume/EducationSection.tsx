import React from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { EducationItem } from './resumeTypes';
import { CollapsibleSection } from './CollapsibleSection';
import { EducationEntryItem, EducationField } from './EducationEntryItem';

export interface EducationSectionProps {
  education: EducationItem[];
  isOpen: boolean;
  onToggle: () => void;
  onAddEducation: () => void;
  onUpdateEducation: (_index: number, _field: EducationField, _val: string) => void;
  onRemoveEducation: (_index: number) => void;
}

export const EducationSection: React.FC<EducationSectionProps> = ({
  education,
  isOpen,
  onToggle,
  onAddEducation,
  onUpdateEducation,
  onRemoveEducation,
}) => (
  <CollapsibleSection
    id="education"
    title="Education"
    countBadge={`${education.length}`}
    icon={<GraduationCap size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
    isOpen={isOpen}
    onToggle={onToggle}
  >
    {education.map((edu, eIdx: number) => (
      <EducationEntryItem
        key={eIdx}
        education={edu}
        index={eIdx}
        onUpdate={(field, val) => {
          onUpdateEducation(eIdx, field, val);
        }}
        onRemove={() => {
          onRemoveEducation(eIdx);
        }}
      />
    ))}

    <button
      type="button"
      onClick={onAddEducation}
      className="btn btn-secondary btn-sm"
      style={{
        alignSelf: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      <Plus size={14} /> Add Education
    </button>
  </CollapsibleSection>
);
