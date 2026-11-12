/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Code, Plus } from 'lucide-react';
import {
  ResumeData,
  BasicsItem,
  LocationItem,
  ProfileItem,
  WorkItem,
  EducationItem,
  ProjectItem,
} from './resumeTypes';
import { CollapsibleSection } from './CollapsibleSection';
import { BasicsFormSection, BasicField, LocationField } from './BasicsFormSection';
import { ProfileField } from './SocialProfileItem';
import { SkillGroupItem } from './SkillGroupItem';
import { WorkExperienceSection } from './WorkExperienceSection';
import { WorkField } from './WorkExperienceItem';
import { EducationSection } from './EducationSection';
import { EducationField } from './EducationEntryItem';
import { ProjectsSection } from './ProjectsSection';
import { ProjectField } from './ProjectEntryItem';

export * from './resumeTypes';
export type { BasicField, LocationField } from './BasicsFormSection';

type SectionKey = 'basics' | 'skills' | 'work' | 'education' | 'projects';

export interface ResumeFormEditorProps {
  resume: ResumeData;
  onChange: (updatedResume: ResumeData) => void;
}

export const ResumeFormEditor: React.FC<ResumeFormEditorProps> = ({ resume, onChange }) => {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    basics: true,
    skills: true,
    work: true,
    education: true,
    projects: false,
  });

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => {
      switch (section) {
        case 'basics':
          return { ...prev, basics: !prev.basics };
        case 'skills':
          return { ...prev, skills: !prev.skills };
        case 'work':
          return { ...prev, work: !prev.work };
        case 'education':
          return { ...prev, education: !prev.education };
        case 'projects':
          return { ...prev, projects: !prev.projects };
      }
    });
  };

  // --- Basics Handlers ---
  const updateBasics = (field: BasicField, value: string) => {
    const basics: BasicsItem = { ...(resume.basics ?? {}) };
    const trimmed = value.trim();
    switch (field) {
      case 'name':
        basics.name = value;
        break;
      case 'label':
        basics.label = value;
        break;
      case 'email':
        if (trimmed) {
          basics.email = trimmed;
        } else {
          delete basics.email;
        }
        break;
      case 'phone':
        basics.phone = value;
        break;
      case 'url':
        if (trimmed) {
          basics.url = trimmed;
        } else {
          delete basics.url;
        }
        break;
      case 'summary':
        basics.summary = value;
        break;
    }
    onChange({ ...resume, basics });
  };

  const updateLocation = (field: LocationField, value: string) => {
    const basics: BasicsItem = { ...(resume.basics ?? {}) };
    const location: LocationItem = { ...(basics.location ?? {}) };
    switch (field) {
      case 'city':
        location.city = value;
        break;
      case 'region':
        location.region = value;
        break;
    }
    basics.location = location;
    onChange({ ...resume, basics });
  };

  // --- Profiles Handlers ---
  const addProfile = () => {
    const basics: BasicsItem = { ...(resume.basics ?? {}) };
    basics.profiles = [...(basics.profiles ?? []), { network: '', username: '' }];
    onChange({ ...resume, basics });
  };

  const updateProfile = (index: number, field: ProfileField, value: string) => {
    const basics: BasicsItem = { ...(resume.basics ?? {}) };
    const profiles = (basics.profiles ?? []).map((item, idx) => {
      if (idx !== index) return item;
      const updated: ProfileItem = { ...item };
      const trimmed = value.trim();
      switch (field) {
        case 'network':
          updated.network = value;
          break;
        case 'username':
          updated.username = value;
          break;
        case 'url':
          if (trimmed) {
            updated.url = trimmed;
          } else {
            delete updated.url;
          }
          break;
      }
      return updated;
    });
    basics.profiles = profiles;
    onChange({ ...resume, basics });
  };

  const removeProfile = (index: number) => {
    const basics: BasicsItem = { ...(resume.basics ?? {}) };
    basics.profiles = (basics.profiles ?? []).filter((_: unknown, i: number) => i !== index);
    onChange({ ...resume, basics });
  };

  // --- Skills Handlers ---
  const addSkillGroup = () => {
    const skills = [...(resume.skills ?? []), { name: 'New Category', keywords: [] }];
    onChange({ ...resume, skills });
  };

  const updateSkillName = (groupIndex: number, name: string) => {
    const skills = (resume.skills ?? []).map((s, idx) => (idx === groupIndex ? { ...s, name } : s));
    onChange({ ...resume, skills });
  };

  const addSkillKeyword = (groupIndex: number, keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const skills = (resume.skills ?? []).map((s, idx) => {
      if (idx !== groupIndex) return s;
      const existing = s.keywords ?? [];
      if (existing.includes(trimmed)) return s;
      return { ...s, keywords: [...existing, trimmed] };
    });
    onChange({ ...resume, skills });
  };

  const removeSkillKeyword = (groupIndex: number, keywordIndex: number) => {
    const skills = (resume.skills ?? []).map((s, idx) => {
      if (idx !== groupIndex) return s;
      const keywords = (s.keywords ?? []).filter(
        (_: string, kIdx: number) => kIdx !== keywordIndex
      );
      return { ...s, keywords };
    });
    onChange({ ...resume, skills });
  };

  const removeSkillGroup = (groupIndex: number) => {
    const skills = (resume.skills ?? []).filter((_: unknown, i: number) => i !== groupIndex);
    onChange({ ...resume, skills });
  };

  // --- Work Experience Handlers ---
  const addWork = () => {
    const work = [
      ...(resume.work ?? []),
      {
        name: '',
        position: '',
        startDate: '',
        summary: '',
        highlights: [],
      },
    ];
    onChange({ ...resume, work });
  };

  const updateWork = (index: number, field: WorkField, value: string) => {
    const work = (resume.work ?? []).map((item, idx) => {
      if (idx !== index) return item;
      const updated: WorkItem = { ...item };
      const trimmed = value.trim();
      switch (field) {
        case 'name':
          updated.name = value;
          break;
        case 'position':
          updated.position = value;
          break;
        case 'startDate':
          if (trimmed) {
            updated.startDate = trimmed;
          } else {
            delete updated.startDate;
          }
          break;
        case 'endDate':
          if (trimmed && trimmed.toLowerCase() !== 'present') {
            updated.endDate = trimmed;
          } else {
            delete updated.endDate;
          }
          break;
        case 'summary':
          updated.summary = value;
          break;
      }
      return updated;
    });
    onChange({ ...resume, work });
  };

  const removeWork = (index: number) => {
    const work = (resume.work ?? []).filter((_: unknown, i: number) => i !== index);
    onChange({ ...resume, work });
  };

  const addWorkHighlight = (workIndex: number, bulletText: string) => {
    const trimmed = bulletText.trim();
    if (!trimmed) return;
    const work = (resume.work ?? []).map((w, idx) => {
      if (idx !== workIndex) return w;
      const highlights = [...(w.highlights ?? []), trimmed];
      return { ...w, highlights };
    });
    onChange({ ...resume, work });
  };

  const updateWorkHighlight = (workIndex: number, highlightIndex: number, value: string) => {
    const work = (resume.work ?? []).map((w, idx) => {
      if (idx !== workIndex) return w;
      const highlights = (w.highlights ?? []).map((h, hIdx) =>
        hIdx === highlightIndex ? value : h
      );
      return { ...w, highlights };
    });
    onChange({ ...resume, work });
  };

  const removeWorkHighlight = (workIndex: number, highlightIndex: number) => {
    const work = (resume.work ?? []).map((w, idx) => {
      if (idx !== workIndex) return w;
      const highlights = (w.highlights ?? []).filter((_, hIdx) => hIdx !== highlightIndex);
      return { ...w, highlights };
    });
    onChange({ ...resume, work });
  };

  // --- Education Handlers ---
  const addEducation = () => {
    const education = [
      ...(resume.education ?? []),
      {
        institution: '',
        studyType: '',
        area: '',
        startDate: '',
      },
    ];
    onChange({ ...resume, education });
  };

  const updateEducation = (index: number, field: EducationField, value: string) => {
    const education = (resume.education ?? []).map((item, idx) => {
      if (idx !== index) return item;
      const updated: EducationItem = { ...item };
      const trimmed = value.trim();
      switch (field) {
        case 'institution':
          updated.institution = value;
          break;
        case 'area':
          updated.area = value;
          break;
        case 'studyType':
          updated.studyType = value;
          break;
        case 'startDate':
          if (trimmed) {
            updated.startDate = trimmed;
          } else {
            delete updated.startDate;
          }
          break;
        case 'endDate':
          if (trimmed && trimmed.toLowerCase() !== 'present') {
            updated.endDate = trimmed;
          } else {
            delete updated.endDate;
          }
          break;
        case 'score':
          if (trimmed) {
            updated.score = trimmed;
          } else {
            delete updated.score;
          }
          break;
      }
      return updated;
    });
    onChange({ ...resume, education });
  };

  const removeEducation = (index: number) => {
    const education = (resume.education ?? []).filter((_: unknown, i: number) => i !== index);
    onChange({ ...resume, education });
  };

  // --- Projects Handlers ---
  const addProject = () => {
    const projects = [
      ...(resume.projects ?? []),
      {
        name: '',
        description: '',
        highlights: [],
      },
    ];
    onChange({ ...resume, projects });
  };

  const updateProject = (index: number, field: ProjectField, value: string) => {
    const projects = (resume.projects ?? []).map((item, idx) => {
      if (idx !== index) return item;
      const updated: ProjectItem = { ...item };
      const trimmed = value.trim();
      switch (field) {
        case 'name':
          updated.name = value;
          break;
        case 'description':
          updated.description = value;
          break;
        case 'url':
          if (trimmed) {
            updated.url = trimmed;
          } else {
            delete updated.url;
          }
          break;
      }
      return updated;
    });
    onChange({ ...resume, projects });
  };

  const removeProject = (index: number) => {
    const projects = (resume.projects ?? []).filter((_: unknown, i: number) => i !== index);
    onChange({ ...resume, projects });
  };

  const basics = resume.basics ?? {};
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const work = Array.isArray(resume.work) ? resume.work : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Basics & Contact */}
      <BasicsFormSection
        basics={basics}
        isOpen={openSections.basics}
        onToggle={() => {
          toggleSection('basics');
        }}
        onUpdateBasics={updateBasics}
        onUpdateLocation={updateLocation}
        onAddProfile={addProfile}
        onUpdateProfile={updateProfile}
        onRemoveProfile={removeProfile}
      />

      {/* 2. Skills & Tag Chips */}
      <CollapsibleSection
        id="skills"
        title="Skills & Competencies"
        countBadge={`${skills.length} categories`}
        icon={<Code size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
        isOpen={openSections.skills}
        onToggle={() => {
          toggleSection('skills');
        }}
      >
        {skills.map((group, gIdx: number) => (
          <SkillGroupItem
            key={gIdx}
            group={group}
            groupIndex={gIdx}
            onUpdateName={(name) => {
              updateSkillName(gIdx, name);
            }}
            onAddKeyword={(kw) => {
              addSkillKeyword(gIdx, kw);
            }}
            onRemoveKeyword={(kIdx) => {
              removeSkillKeyword(gIdx, kIdx);
            }}
            onRemoveGroup={() => {
              removeSkillGroup(gIdx);
            }}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            addSkillGroup();
          }}
          className="btn btn-secondary btn-sm"
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Plus size={14} /> Add Skill Category
        </button>
      </CollapsibleSection>

      {/* 3. Work Experience */}
      <WorkExperienceSection
        work={work}
        isOpen={openSections.work}
        onToggle={() => {
          toggleSection('work');
        }}
        onAddWork={addWork}
        onUpdateWork={updateWork}
        onRemoveWork={removeWork}
        onAddHighlight={addWorkHighlight}
        onUpdateHighlight={updateWorkHighlight}
        onRemoveHighlight={removeWorkHighlight}
      />

      {/* 4. Education */}
      <EducationSection
        education={education}
        isOpen={openSections.education}
        onToggle={() => {
          toggleSection('education');
        }}
        onAddEducation={addEducation}
        onUpdateEducation={updateEducation}
        onRemoveEducation={removeEducation}
      />

      {/* 5. Projects */}
      <ProjectsSection
        projects={projects}
        isOpen={openSections.projects}
        onToggle={() => {
          toggleSection('projects');
        }}
        onAddProject={addProject}
        onUpdateProject={updateProject}
        onRemoveProject={removeProject}
      />
    </div>
  );
};
