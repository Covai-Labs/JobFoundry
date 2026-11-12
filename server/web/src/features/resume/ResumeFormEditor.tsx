import React, { useState } from 'react';
import { User, Briefcase, GraduationCap, Code, FolderGit2, Plus } from 'lucide-react';
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
import { SocialProfileItem, ProfileField } from './SocialProfileItem';
import { SkillGroupItem } from './SkillGroupItem';
import { WorkExperienceItem, WorkField } from './WorkExperienceItem';
import { EducationEntryItem, EducationField } from './EducationEntryItem';
import { ProjectEntryItem, ProjectField } from './ProjectEntryItem';

export * from './resumeTypes';

type SectionKey = 'basics' | 'skills' | 'work' | 'education' | 'projects';
type BasicField = 'name' | 'label' | 'email' | 'phone' | 'url' | 'summary';
type LocationField = 'city' | 'region';

export interface ResumeFormEditorProps {
  resume: ResumeData;
  onChange(updatedResume: ResumeData): void;
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
  const profiles = Array.isArray(basics.profiles) ? basics.profiles : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const work = Array.isArray(resume.work) ? resume.work : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Basics & Contact */}
      <CollapsibleSection
        id="basics"
        title="Basics & Contact"
        icon={<User size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
        isOpen={openSections.basics}
        onToggle={() => {
          toggleSection('basics');
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label
              htmlFor="basics-name"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Full Name
            </label>
            <input
              id="basics-name"
              type="text"
              value={basics.name ?? ''}
              onChange={(e) => {
                updateBasics('name', e.target.value);
              }}
              placeholder="e.g. Jane Doe"
              className="input-text"
            />
          </div>
          <div>
            <label
              htmlFor="basics-label"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Professional Headline / Title
            </label>
            <input
              id="basics-label"
              type="text"
              value={basics.label ?? ''}
              onChange={(e) => {
                updateBasics('label', e.target.value);
              }}
              placeholder="e.g. Lead Staff Systems Engineer"
              className="input-text"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label
              htmlFor="basics-email"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Email Address
            </label>
            <input
              id="basics-email"
              type="email"
              value={basics.email ?? ''}
              onChange={(e) => {
                updateBasics('email', e.target.value);
              }}
              placeholder="jane@example.com"
              className="input-text"
            />
          </div>
          <div>
            <label
              htmlFor="basics-phone"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Phone Number
            </label>
            <input
              id="basics-phone"
              type="tel"
              value={basics.phone ?? ''}
              onChange={(e) => {
                updateBasics('phone', e.target.value);
              }}
              placeholder="+1 555-0199"
              className="input-text"
            />
          </div>
          <div>
            <label
              htmlFor="basics-url"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Personal Website / Portfolio
            </label>
            <input
              id="basics-url"
              type="url"
              value={basics.url ?? ''}
              onChange={(e) => {
                updateBasics('url', e.target.value);
              }}
              placeholder="https://janedoe.dev"
              className="input-text"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label
              htmlFor="basics-city"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              City
            </label>
            <input
              id="basics-city"
              type="text"
              value={basics.location?.city ?? ''}
              onChange={(e) => {
                updateLocation('city', e.target.value);
              }}
              placeholder="San Francisco"
              className="input-text"
            />
          </div>
          <div>
            <label
              htmlFor="basics-region"
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Region / State / Country
            </label>
            <input
              id="basics-region"
              type="text"
              value={basics.location?.region ?? ''}
              onChange={(e) => {
                updateLocation('region', e.target.value);
              }}
              placeholder="California, USA"
              className="input-text"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="basics-summary"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Professional Summary / Bio
          </label>
          <textarea
            id="basics-summary"
            value={basics.summary ?? ''}
            onChange={(e) => {
              updateBasics('summary', e.target.value);
            }}
            placeholder="Seasoned engineer with 8+ years building distributed platforms..."
            rows={3}
            className="input-text"
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Social Profiles */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Social & Professional Profiles ({profiles.length})
            </span>
            <button
              type="button"
              onClick={() => {
                addProfile();
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            >
              <Plus size={12} /> Add Profile
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {profiles.map((prof: ProfileItem, pIdx: number) => (
              <SocialProfileItem
                key={pIdx}
                profile={prof}
                index={pIdx}
                onUpdate={(field, val) => {
                  updateProfile(pIdx, field, val);
                }}
                onRemove={() => {
                  removeProfile(pIdx);
                }}
              />
            ))}
          </div>
        </div>
      </CollapsibleSection>

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
      <CollapsibleSection
        id="work"
        title="Work Experience"
        countBadge={`${work.length} roles`}
        icon={<Briefcase size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
        isOpen={openSections.work}
        onToggle={() => {
          toggleSection('work');
        }}
      >
        {work.map((w, wIdx: number) => (
          <WorkExperienceItem
            key={wIdx}
            work={w}
            workIndex={wIdx}
            onUpdate={(field, val) => {
              updateWork(wIdx, field, val);
            }}
            onRemove={() => {
              removeWork(wIdx);
            }}
            onAddHighlight={(text) => {
              addWorkHighlight(wIdx, text);
            }}
            onUpdateHighlight={(hIdx, text) => {
              updateWorkHighlight(wIdx, hIdx, text);
            }}
            onRemoveHighlight={(hIdx) => {
              removeWorkHighlight(wIdx, hIdx);
            }}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            addWork();
          }}
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

      {/* 4. Education */}
      <CollapsibleSection
        id="education"
        title="Education"
        countBadge={`${education.length}`}
        icon={<GraduationCap size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
        isOpen={openSections.education}
        onToggle={() => {
          toggleSection('education');
        }}
      >
        {education.map((edu, eIdx: number) => (
          <EducationEntryItem
            key={eIdx}
            education={edu}
            index={eIdx}
            onUpdate={(field, val) => {
              updateEducation(eIdx, field, val);
            }}
            onRemove={() => {
              removeEducation(eIdx);
            }}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            addEducation();
          }}
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

      {/* 5. Projects */}
      <CollapsibleSection
        id="projects"
        title="Projects"
        countBadge={`${projects.length}`}
        icon={<FolderGit2 size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
        isOpen={openSections.projects}
        onToggle={() => {
          toggleSection('projects');
        }}
      >
        {projects.map((proj, pIdx: number) => (
          <ProjectEntryItem
            key={pIdx}
            project={proj}
            index={pIdx}
            onUpdate={(field, val) => {
              updateProject(pIdx, field, val);
            }}
            onRemove={() => {
              removeProject(pIdx);
            }}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            addProject();
          }}
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
    </div>
  );
};
