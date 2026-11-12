import React, { useState } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  Code,
  FolderGit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type SectionKey = 'basics' | 'skills' | 'work' | 'education' | 'projects';
type BasicField = 'name' | 'label' | 'email' | 'phone' | 'url' | 'summary';
type LocationField = 'city' | 'region';
type ProfileField = 'network' | 'username' | 'url';
type WorkField = 'name' | 'position' | 'startDate' | 'endDate' | 'summary';
type EducationField = 'institution' | 'studyType' | 'area' | 'startDate' | 'endDate' | 'score';
type ProjectField = 'name' | 'url' | 'description';

export interface ProfileItem {
  network?: string;
  username?: string;
  url?: string;
}

export interface SkillItem {
  name?: string;
  keywords?: string[];
}

export interface WorkItem {
  name?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface EducationItem {
  institution?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
}

export interface ProjectItem {
  name?: string;
  description?: string;
  url?: string;
  highlights?: string[];
  keywords?: string[];
}

export interface LocationItem {
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
}

export interface BasicsItem {
  name?: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: LocationItem;
  profiles?: ProfileItem[];
}

export interface ResumeData {
  $schema?: string;
  basics?: BasicsItem;
  skills?: SkillItem[];
  work?: WorkItem[];
  education?: EducationItem[];
  projects?: ProjectItem[];
  [key: string]: unknown;
}

export interface ResumeFormEditorProps {
  resume: ResumeData;
  onChange: (updatedResume: ResumeData) => void;
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  countBadge?: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  countBadge,
  icon,
  isOpen,
  onToggle,
  children,
}) => (
  <div
    className="card"
    style={{
      padding: '1rem',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    }}
  >
    <button
      id={`section-btn-${id}`}
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={`section-content-${id}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon}
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          {title} {countBadge && <span style={{ opacity: 0.75 }}>({countBadge})</span>}
        </h4>
      </div>
      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>

    {isOpen && (
      <div
        id={`section-content-${id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginTop: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '0.85rem',
        }}
      >
        {children}
      </div>
    )}
  </div>
);

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

  const updateResume = (updater: (prev: ResumeData) => ResumeData) => {
    const updated = updater(resume || {});
    onChange(updated);
  };

  // --- Basics Handlers ---
  const updateBasics = (field: BasicField, value: string) => {
    updateResume((prev) => {
      const basics: BasicsItem = { ...(prev.basics || {}) };
      const trimmed = value.trim();
      switch (field) {
        case 'name':
          basics.name = value;
          break;
        case 'label':
          basics.label = value;
          break;
        case 'email':
          if (trimmed) basics.email = trimmed;
          else delete basics.email;
          break;
        case 'phone':
          basics.phone = value;
          break;
        case 'url':
          if (trimmed) basics.url = trimmed;
          else delete basics.url;
          break;
        case 'summary':
          basics.summary = value;
          break;
      }
      return { ...prev, basics };
    });
  };

  const updateLocation = (field: LocationField, value: string) => {
    updateResume((prev) => {
      const basics: BasicsItem = { ...(prev.basics || {}) };
      const location: LocationItem = { ...(basics.location || {}) };
      switch (field) {
        case 'city':
          location.city = value;
          break;
        case 'region':
          location.region = value;
          break;
      }
      basics.location = location;
      return { ...prev, basics };
    });
  };

  // --- Profiles Handlers ---
  const addProfile = () => {
    updateResume((prev) => {
      const basics: BasicsItem = { ...(prev.basics || {}) };
      basics.profiles = [...(basics.profiles || []), { network: '', username: '' }];
      return { ...prev, basics };
    });
  };

  const updateProfile = (index: number, field: ProfileField, value: string) => {
    updateResume((prev) => {
      const basics: BasicsItem = { ...(prev.basics || {}) };
      const profiles = [...(basics.profiles || [])];
      const item: ProfileItem = { ...(profiles[index] || {}) };
      const trimmed = value.trim();
      switch (field) {
        case 'network':
          item.network = value;
          break;
        case 'username':
          item.username = value;
          break;
        case 'url':
          if (trimmed) item.url = trimmed;
          else delete item.url;
          break;
      }
      profiles[index] = item;
      basics.profiles = profiles;
      return { ...prev, basics };
    });
  };

  const removeProfile = (index: number) => {
    updateResume((prev) => {
      const basics: BasicsItem = { ...(prev.basics || {}) };
      basics.profiles = (basics.profiles || []).filter((_: unknown, i: number) => i !== index);
      return { ...prev, basics };
    });
  };

  // --- Skills Handlers ---
  const addSkillGroup = () => {
    updateResume((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { name: 'New Category', keywords: [] }],
    }));
  };

  const updateSkillName = (groupIndex: number, name: string) => {
    updateResume((prev) => {
      const skills = [...(prev.skills || [])];
      skills[groupIndex] = { ...skills[groupIndex], name };
      return { ...prev, skills };
    });
  };

  const addSkillKeyword = (groupIndex: number, keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    updateResume((prev) => {
      const skills = [...(prev.skills || [])];
      const existing = skills[groupIndex]?.keywords || [];
      if (!existing.includes(trimmed)) {
        skills[groupIndex] = {
          ...skills[groupIndex],
          keywords: [...existing, trimmed],
        };
      }
      return { ...prev, skills };
    });
  };

  const removeSkillKeyword = (groupIndex: number, keywordIndex: number) => {
    updateResume((prev) => {
      const skills = [...(prev.skills || [])];
      const keywords = (skills[groupIndex]?.keywords || []).filter(
        (_: string, i: number) => i !== keywordIndex
      );
      skills[groupIndex] = { ...skills[groupIndex], keywords };
      return { ...prev, skills };
    });
  };

  const removeSkillGroup = (groupIndex: number) => {
    updateResume((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((_: unknown, i: number) => i !== groupIndex),
    }));
  };

  // --- Work Experience Handlers ---
  const addWork = () => {
    updateResume((prev) => ({
      ...prev,
      work: [
        ...(prev.work || []),
        {
          name: '',
          position: '',
          startDate: '',
          summary: '',
          highlights: [],
        },
      ],
    }));
  };

  const updateWork = (index: number, field: WorkField, value: string) => {
    updateResume((prev) => {
      const work = [...(prev.work || [])];
      const item: WorkItem = { ...(work[index] || {}) };
      const trimmed = value.trim();
      switch (field) {
        case 'name':
          item.name = value;
          break;
        case 'position':
          item.position = value;
          break;
        case 'startDate':
          if (trimmed) item.startDate = trimmed;
          else delete item.startDate;
          break;
        case 'endDate':
          if (trimmed && trimmed.toLowerCase() !== 'present') {
            item.endDate = trimmed;
          } else {
            delete item.endDate;
          }
          break;
        case 'summary':
          item.summary = value;
          break;
      }
      work[index] = item;
      return { ...prev, work };
    });
  };

  const removeWork = (index: number) => {
    updateResume((prev) => ({
      ...prev,
      work: (prev.work || []).filter((_: unknown, i: number) => i !== index),
    }));
  };

  const addWorkHighlight = (workIndex: number, bulletText: string) => {
    const trimmed = bulletText.trim();
    if (!trimmed) return;
    updateResume((prev) => {
      const work = [...(prev.work || [])];
      const highlights = [...(work[workIndex]?.highlights || []), trimmed];
      work[workIndex] = { ...work[workIndex], highlights };
      return { ...prev, work };
    });
  };

  const updateWorkHighlight = (workIndex: number, highlightIndex: number, value: string) => {
    updateResume((prev) => {
      const work = [...(prev.work || [])];
      const highlights = [...(work[workIndex]?.highlights || [])];
      highlights[highlightIndex] = value;
      work[workIndex] = { ...work[workIndex], highlights };
      return { ...prev, work };
    });
  };

  const removeWorkHighlight = (workIndex: number, highlightIndex: number) => {
    updateResume((prev) => {
      const work = [...(prev.work || [])];
      const highlights = (work[workIndex]?.highlights || []).filter(
        (_: string, i: number) => i !== highlightIndex
      );
      work[workIndex] = { ...work[workIndex], highlights };
      return { ...prev, work };
    });
  };

  // --- Education Handlers ---
  const addEducation = () => {
    updateResume((prev) => ({
      ...prev,
      education: [
        ...(prev.education || []),
        {
          institution: '',
          studyType: '',
          area: '',
          startDate: '',
        },
      ],
    }));
  };

  const updateEducation = (index: number, field: EducationField, value: string) => {
    updateResume((prev) => {
      const education = [...(prev.education || [])];
      const item: EducationItem = { ...(education[index] || {}) };
      const trimmed = value.trim();
      switch (field) {
        case 'institution':
          item.institution = value;
          break;
        case 'area':
          item.area = value;
          break;
        case 'studyType':
          item.studyType = value;
          break;
        case 'startDate':
          if (trimmed) item.startDate = trimmed;
          else delete item.startDate;
          break;
        case 'endDate':
          if (trimmed && trimmed.toLowerCase() !== 'present') {
            item.endDate = trimmed;
          } else {
            delete item.endDate;
          }
          break;
        case 'score':
          if (trimmed) item.score = trimmed;
          else delete item.score;
          break;
      }
      education[index] = item;
      return { ...prev, education };
    });
  };

  const removeEducation = (index: number) => {
    updateResume((prev) => ({
      ...prev,
      education: (prev.education || []).filter((_: unknown, i: number) => i !== index),
    }));
  };

  // --- Projects Handlers ---
  const addProject = () => {
    updateResume((prev) => ({
      ...prev,
      projects: [
        ...(prev.projects || []),
        {
          name: '',
          description: '',
          highlights: [],
        },
      ],
    }));
  };

  const updateProject = (index: number, field: ProjectField, value: string) => {
    updateResume((prev) => {
      const projects = [...(prev.projects || [])];
      const item: ProjectItem = { ...(projects[index] || {}) };
      const trimmed = value.trim();
      switch (field) {
        case 'name':
          item.name = value;
          break;
        case 'description':
          item.description = value;
          break;
        case 'url':
          if (trimmed) item.url = trimmed;
          else delete item.url;
          break;
      }
      projects[index] = item;
      return { ...prev, projects };
    });
  };

  const removeProject = (index: number) => {
    updateResume((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((_: unknown, i: number) => i !== index),
    }));
  };

  const basics = resume.basics || {};
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
        onToggle={() => toggleSection('basics')}
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
              value={basics.name || ''}
              onChange={(e) => updateBasics('name', e.target.value)}
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
              value={basics.label || ''}
              onChange={(e) => updateBasics('label', e.target.value)}
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
              value={basics.email || ''}
              onChange={(e) => updateBasics('email', e.target.value)}
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
              value={basics.phone || ''}
              onChange={(e) => updateBasics('phone', e.target.value)}
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
              value={basics.url || ''}
              onChange={(e) => updateBasics('url', e.target.value)}
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
              value={basics.location?.city || ''}
              onChange={(e) => updateLocation('city', e.target.value)}
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
              value={basics.location?.region || ''}
              onChange={(e) => updateLocation('region', e.target.value)}
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
            value={basics.summary || ''}
            onChange={(e) => updateBasics('summary', e.target.value)}
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
              onClick={addProfile}
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
                onUpdate={(field, val) => updateProfile(pIdx, field, val)}
                onRemove={() => removeProfile(pIdx)}
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
        onToggle={() => toggleSection('skills')}
      >
        {skills.map((group: SkillItem, gIdx: number) => (
          <SkillGroupItem
            key={gIdx}
            group={group}
            groupIndex={gIdx}
            onUpdateName={(name) => updateSkillName(gIdx, name)}
            onAddKeyword={(kw) => addSkillKeyword(gIdx, kw)}
            onRemoveKeyword={(kIdx) => removeSkillKeyword(gIdx, kIdx)}
            onRemoveGroup={() => removeSkillGroup(gIdx)}
          />
        ))}

        <button
          type="button"
          onClick={addSkillGroup}
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
        onToggle={() => toggleSection('work')}
      >
        {work.map((w: WorkItem, wIdx: number) => (
          <WorkExperienceItem
            key={wIdx}
            work={w}
            workIndex={wIdx}
            onUpdate={(field, val) => updateWork(wIdx, field, val)}
            onRemove={() => removeWork(wIdx)}
            onAddHighlight={(text) => addWorkHighlight(wIdx, text)}
            onUpdateHighlight={(hIdx, text) => updateWorkHighlight(wIdx, hIdx, text)}
            onRemoveHighlight={(hIdx) => removeWorkHighlight(wIdx, hIdx)}
          />
        ))}

        <button
          type="button"
          onClick={addWork}
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
        onToggle={() => toggleSection('education')}
      >
        {education.map((edu: EducationItem, eIdx: number) => (
          <EducationEntryItem
            key={eIdx}
            education={edu}
            index={eIdx}
            onUpdate={(field, val) => updateEducation(eIdx, field, val)}
            onRemove={() => removeEducation(eIdx)}
          />
        ))}

        <button
          type="button"
          onClick={addEducation}
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
        onToggle={() => toggleSection('projects')}
      >
        {projects.map((proj: ProjectItem, pIdx: number) => (
          <ProjectEntryItem
            key={pIdx}
            project={proj}
            index={pIdx}
            onUpdate={(field, val) => updateProject(pIdx, field, val)}
            onRemove={() => removeProject(pIdx)}
          />
        ))}

        <button
          type="button"
          onClick={addProject}
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

// --- Subcomponents for Clean Rendering & High Reusability ---

const SocialProfileItem: React.FC<{
  profile: ProfileItem;
  index: number;
  onUpdate: (field: ProfileField, val: string) => void;
  onRemove: () => void;
}> = ({ profile, index, onUpdate, onRemove }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '120px 140px 1fr auto',
      gap: '0.45rem',
      alignItems: 'center',
    }}
  >
    <label htmlFor={`profile-${index}-network`} style={{ display: 'none' }}>
      Platform / Network
    </label>
    <input
      id={`profile-${index}-network`}
      aria-label="Platform / Network"
      type="text"
      value={profile.network || ''}
      onChange={(e) => onUpdate('network', e.target.value)}
      placeholder="e.g. GitHub"
      className="input-text"
      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
    />

    <label htmlFor={`profile-${index}-username`} style={{ display: 'none' }}>
      Username / Handle
    </label>
    <input
      id={`profile-${index}-username`}
      aria-label="Username / Handle"
      type="text"
      value={profile.username || ''}
      onChange={(e) => onUpdate('username', e.target.value)}
      placeholder="Username"
      className="input-text"
      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
    />

    <label htmlFor={`profile-${index}-url`} style={{ display: 'none' }}>
      Profile URL
    </label>
    <input
      id={`profile-${index}-url`}
      aria-label="Profile URL"
      type="url"
      value={profile.url || ''}
      onChange={(e) => onUpdate('url', e.target.value)}
      placeholder="https://github.com/..."
      className="input-text"
      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
    />

    <button
      type="button"
      onClick={onRemove}
      className="btn btn-danger btn-sm"
      style={{ padding: '0.2rem 0.4rem' }}
      title="Delete profile"
      aria-label={`Delete profile ${profile.network || index + 1}`}
    >
      <Trash2 size={12} />
    </button>
  </div>
);

const SkillGroupItem: React.FC<{
  group: SkillItem;
  groupIndex: number;
  onUpdateName: (name: string) => void;
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kIdx: number) => void;
  onRemoveGroup: () => void;
}> = ({ group, groupIndex, onUpdateName, onAddKeyword, onRemoveKeyword, onRemoveGroup }) => {
  const [newKeyword, setNewKeyword] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      onAddKeyword(newKeyword);
      setNewKeyword('');
    }
  };

  const handleAddClick = () => {
    onAddKeyword(newKeyword);
    setNewKeyword('');
  };

  const keywords = Array.isArray(group.keywords) ? group.keywords : [];

  return (
    <div
      style={{
        background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
        padding: '0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <label htmlFor={`skill-group-${groupIndex}-name`} style={{ display: 'none' }}>
          Category Name
        </label>
        <input
          id={`skill-group-${groupIndex}-name`}
          aria-label="Category Name"
          type="text"
          value={group.name || ''}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="Category name (e.g. Languages, Cloud & DevOps, Databases)"
          className="input-text"
          style={{ fontWeight: 600, fontSize: '0.88rem' }}
        />
        <button
          type="button"
          onClick={onRemoveGroup}
          className="btn btn-danger btn-sm"
          style={{ padding: '0.2rem 0.4rem' }}
          title="Delete category"
          aria-label={`Delete skill category ${group.name || groupIndex + 1}`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Keyword Tag Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        {keywords.map((kw: string, kIdx: number) => (
          <span
            key={kIdx}
            className="badge"
            style={{
              fontSize: '0.75rem',
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.5rem',
            }}
          >
            {kw}
            <button
              type="button"
              onClick={() => onRemoveKeyword(kIdx)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                fontSize: '0.75rem',
                lineHeight: 1,
              }}
              aria-label={`Remove skill tag ${kw}`}
            >
              ✕
            </button>
          </span>
        ))}

        <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <label htmlFor={`skill-group-${groupIndex}-add-keyword`} style={{ display: 'none' }}>
            Add skill tag
          </label>
          <input
            id={`skill-group-${groupIndex}-add-keyword`}
            aria-label="Add skill tag"
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="+ Add skill tag"
            className="input-text"
            style={{
              fontSize: '0.75rem',
              height: '26px',
              padding: '0 0.5rem',
              width: '120px',
            }}
          />
          {newKeyword.trim() && (
            <button
              type="button"
              onClick={handleAddClick}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', height: '26px' }}
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const WorkExperienceItem: React.FC<{
  work: WorkItem;
  workIndex: number;
  onUpdate: (field: WorkField, val: string) => void;
  onRemove: () => void;
  onAddHighlight: (text: string) => void;
  onUpdateHighlight: (hIdx: number, text: string) => void;
  onRemoveHighlight: (hIdx: number) => void;
}> = ({
  work,
  workIndex,
  onUpdate,
  onRemove,
  onAddHighlight,
  onUpdateHighlight,
  onRemoveHighlight,
}) => {
  const [newHighlight, setNewHighlight] = useState('');

  const handleAddBullet = () => {
    if (!newHighlight.trim()) return;
    onAddHighlight(newHighlight);
    setNewHighlight('');
  };

  const highlights = Array.isArray(work.highlights) ? work.highlights : [];

  return (
    <div
      style={{
        background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
        padding: '0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
          {work.position
            ? `${work.position} @ ${work.name || 'Company'}`
            : `Work Entry #${workIndex + 1}`}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="btn btn-danger btn-sm"
          style={{ padding: '0.2rem 0.4rem' }}
          title="Delete role"
          aria-label={`Delete role at ${work.name || workIndex + 1}`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <div>
          <label
            htmlFor={`work-${workIndex}-name`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Company Name
          </label>
          <input
            id={`work-${workIndex}-name`}
            type="text"
            value={work.name || ''}
            onChange={(e) => onUpdate('name', e.target.value)}
            placeholder="e.g. Acme Corp"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <label
            htmlFor={`work-${workIndex}-position`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Role / Title
          </label>
          <input
            id={`work-${workIndex}-position`}
            type="text"
            value={work.position || ''}
            onChange={(e) => onUpdate('position', e.target.value)}
            placeholder="e.g. Senior Software Engineer"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <div>
          <label
            htmlFor={`work-${workIndex}-start-date`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Start Date
          </label>
          <input
            id={`work-${workIndex}-start-date`}
            type="text"
            value={work.startDate || ''}
            onChange={(e) => onUpdate('startDate', e.target.value)}
            placeholder="YYYY-MM (e.g. 2021-03)"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <label
            htmlFor={`work-${workIndex}-end-date`}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            End Date (leave blank or 'Present' if current)
          </label>
          <input
            id={`work-${workIndex}-end-date`}
            type="text"
            value={work.endDate || ''}
            onChange={(e) => onUpdate('endDate', e.target.value)}
            placeholder="YYYY-MM or Present"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`work-${workIndex}-summary`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Role Summary
        </label>
        <textarea
          id={`work-${workIndex}-summary`}
          value={work.summary || ''}
          onChange={(e) => onUpdate('summary', e.target.value)}
          placeholder="Brief overview of role responsibilities and team scope..."
          rows={2}
          className="input-text"
          style={{ resize: 'vertical', fontSize: '0.82rem' }}
        />
      </div>

      {/* Highlights / Accomplishment Bullets */}
      <div>
        <label
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '0.35rem',
          }}
        >
          Key Achievements & Responsibilities (Bullets)
        </label>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            marginBottom: '0.5rem',
          }}
        >
          {highlights.map((bullet: string, hIdx: number) => (
            <div
              key={hIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '0.4rem',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
              <input
                id={`work-${workIndex}-bullet-${hIdx}`}
                aria-label={`Achievement bullet ${hIdx + 1}`}
                type="text"
                value={bullet}
                onChange={(e) => onUpdateHighlight(hIdx, e.target.value)}
                className="input-text"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
              />
              <button
                type="button"
                onClick={() => onRemoveHighlight(hIdx)}
                className="btn btn-danger btn-sm"
                style={{ padding: '0.2rem 0.35rem' }}
                aria-label={`Delete bullet ${hIdx + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem' }}>
          <label htmlFor={`work-${workIndex}-new-bullet`} style={{ display: 'none' }}>
            Add achievement bullet
          </label>
          <input
            id={`work-${workIndex}-new-bullet`}
            aria-label="Add achievement bullet"
            type="text"
            value={newHighlight}
            onChange={(e) => setNewHighlight(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddBullet();
              }
            }}
            placeholder="+ Add achievement bullet (e.g. 'Reduced latency by 40% with Go concurrency')..."
            className="input-text"
            style={{ fontSize: '0.8rem' }}
          />
          <button
            type="button"
            onClick={handleAddBullet}
            disabled={!newHighlight.trim()}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem' }}
          >
            Add Bullet
          </button>
        </div>
      </div>
    </div>
  );
};

const EducationEntryItem: React.FC<{
  education: EducationItem;
  index: number;
  onUpdate: (field: EducationField, val: string) => void;
  onRemove: () => void;
}> = ({ education, index, onUpdate, onRemove }) => (
  <div
    style={{
      background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
      padding: '0.85rem',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
        {education.institution || `Education Entry #${index + 1}`}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="btn btn-danger btn-sm"
        style={{ padding: '0.2rem 0.4rem' }}
        title="Delete education"
        aria-label={`Delete education at ${education.institution || index + 1}`}
      >
        <Trash2 size={12} />
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
      <div>
        <label
          htmlFor={`edu-${index}-institution`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Institution
        </label>
        <input
          id={`edu-${index}-institution`}
          type="text"
          value={education.institution || ''}
          onChange={(e) => onUpdate('institution', e.target.value)}
          placeholder="e.g. Stanford University"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`edu-${index}-degree`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Degree / Study Type
        </label>
        <input
          id={`edu-${index}-degree`}
          type="text"
          value={education.studyType || ''}
          onChange={(e) => onUpdate('studyType', e.target.value)}
          placeholder="e.g. Bachelor of Science"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: '0.6rem' }}>
      <div>
        <label
          htmlFor={`edu-${index}-area`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Field of Study / Major
        </label>
        <input
          id={`edu-${index}-area`}
          type="text"
          value={education.area || ''}
          onChange={(e) => onUpdate('area', e.target.value)}
          placeholder="Computer Science"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`edu-${index}-start-date`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Start Date
        </label>
        <input
          id={`edu-${index}-start-date`}
          type="text"
          value={education.startDate || ''}
          onChange={(e) => onUpdate('startDate', e.target.value)}
          placeholder="2018-09"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`edu-${index}-end-date`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          End Date
        </label>
        <input
          id={`edu-${index}-end-date`}
          type="text"
          value={education.endDate || ''}
          onChange={(e) => onUpdate('endDate', e.target.value)}
          placeholder="2022-06"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>
  </div>
);

const ProjectEntryItem: React.FC<{
  project: ProjectItem;
  index: number;
  onUpdate: (field: ProjectField, val: string) => void;
  onRemove: () => void;
}> = ({ project, index, onUpdate, onRemove }) => (
  <div
    style={{
      background: 'var(--bg-card-inner, rgba(255,255,255,0.02))',
      padding: '0.85rem',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
        {project.name || `Project #${index + 1}`}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="btn btn-danger btn-sm"
        style={{ padding: '0.2rem 0.4rem' }}
        title="Delete project"
        aria-label={`Delete project ${project.name || index + 1}`}
      >
        <Trash2 size={12} />
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
      <div>
        <label
          htmlFor={`project-${index}-name`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Project Name
        </label>
        <input
          id={`project-${index}-name`}
          type="text"
          value={project.name || ''}
          onChange={(e) => onUpdate('name', e.target.value)}
          placeholder="e.g. Distributed Consensus Engine"
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
      <div>
        <label
          htmlFor={`project-${index}-url`}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Project URL
        </label>
        <input
          id={`project-${index}-url`}
          type="url"
          value={project.url || ''}
          onChange={(e) => onUpdate('url', e.target.value)}
          placeholder="https://github.com/..."
          className="input-text"
          style={{ fontSize: '0.82rem' }}
        />
      </div>
    </div>

    <div>
      <label
        htmlFor={`project-${index}-description`}
        style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
      >
        Description
      </label>
      <textarea
        id={`project-${index}-description`}
        value={project.description || ''}
        onChange={(e) => onUpdate('description', e.target.value)}
        placeholder="Short description of the problem solved and technologies used..."
        rows={2}
        className="input-text"
        style={{ resize: 'vertical', fontSize: '0.82rem' }}
      />
    </div>
  </div>
);
