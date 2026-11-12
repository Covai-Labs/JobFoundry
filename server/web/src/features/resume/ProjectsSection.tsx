import React from 'react';
import { FolderGit2, Plus } from 'lucide-react';
import { ProjectItem } from './resumeTypes';
import { CollapsibleSection } from './CollapsibleSection';
import { ProjectEntryItem, ProjectField } from './ProjectEntryItem';

export interface ProjectsSectionProps {
  projects: ProjectItem[];
  isOpen: boolean;
  onToggle: () => void;
  onAddProject: () => void;
  onUpdateProject: (_index: number, _field: ProjectField, _val: string) => void;
  onRemoveProject: (_index: number) => void;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({
  projects,
  isOpen,
  onToggle,
  onAddProject,
  onUpdateProject,
  onRemoveProject,
}) => (
  <CollapsibleSection
    id="projects"
    title="Projects"
    countBadge={`${projects.length}`}
    icon={<FolderGit2 size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
    isOpen={isOpen}
    onToggle={onToggle}
  >
    {projects.map((proj, pIdx: number) => (
      <ProjectEntryItem
        key={pIdx}
        project={proj}
        index={pIdx}
        onUpdate={(field, val) => {
          onUpdateProject(pIdx, field, val);
        }}
        onRemove={() => {
          onRemoveProject(pIdx);
        }}
      />
    ))}

    <button
      type="button"
      onClick={onAddProject}
      className="btn btn-secondary btn-sm"
      style={{
        alignSelf: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      <Plus size={14} /> Add Project
    </button>
  </CollapsibleSection>
);
