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

export interface ResumeFormEditorProps {
  resume: Record<string, any>;
  onChange: (updatedResume: Record<string, any>) => void;
}

export const ResumeFormEditor: React.FC<ResumeFormEditorProps> = ({ resume, onChange }) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true,
    skills: true,
    work: true,
    education: true,
    projects: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Helper updater
  const updateResume = (updater: (prev: Record<string, any>) => Record<string, any>) => {
    const updated = updater(resume || {});
    onChange(updated);
  };

  // --- Basics Handlers ---
  const updateBasics = (field: string, value: any) => {
    updateResume((prev) => ({
      ...prev,
      basics: {
        ...(prev.basics || {}),
        [field]: value,
      },
    }));
  };

  const updateLocation = (field: string, value: any) => {
    updateResume((prev) => ({
      ...prev,
      basics: {
        ...(prev.basics || {}),
        location: {
          ...(prev.basics?.location || {}),
          [field]: value,
        },
      },
    }));
  };

  // --- Profiles Handlers ---
  const addProfile = () => {
    updateResume((prev) => {
      const profiles = [...(prev.basics?.profiles || []), { network: '', username: '', url: '' }];
      return {
        ...prev,
        basics: {
          ...(prev.basics || {}),
          profiles,
        },
      };
    });
  };

  const updateProfile = (index: number, field: string, value: string) => {
    updateResume((prev) => {
      const profiles = [...(prev.basics?.profiles || [])];
      profiles[index] = { ...profiles[index], [field]: value };
      return {
        ...prev,
        basics: {
          ...(prev.basics || {}),
          profiles,
        },
      };
    });
  };

  const removeProfile = (index: number) => {
    updateResume((prev) => {
      const profiles = (prev.basics?.profiles || []).filter((_: any, i: number) => i !== index);
      return {
        ...prev,
        basics: {
          ...(prev.basics || {}),
          profiles,
        },
      };
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
      skills: (prev.skills || []).filter((_: any, i: number) => i !== groupIndex),
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
          endDate: '',
          summary: '',
          highlights: [],
        },
      ],
    }));
  };

  const updateWork = (index: number, field: string, value: any) => {
    updateResume((prev) => {
      const work = [...(prev.work || [])];
      work[index] = { ...work[index], [field]: value };
      return { ...prev, work };
    });
  };

  const removeWork = (index: number) => {
    updateResume((prev) => ({
      ...prev,
      work: (prev.work || []).filter((_: any, i: number) => i !== index),
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
          area: '',
          studyType: '',
          startDate: '',
          endDate: '',
          score: '',
        },
      ],
    }));
  };

  const updateEducation = (index: number, field: string, value: any) => {
    updateResume((prev) => {
      const education = [...(prev.education || [])];
      education[index] = { ...education[index], [field]: value };
      return { ...prev, education };
    });
  };

  const removeEducation = (index: number) => {
    updateResume((prev) => ({
      ...prev,
      education: (prev.education || []).filter((_: any, i: number) => i !== index),
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
          url: '',
          highlights: [],
          keywords: [],
        },
      ],
    }));
  };

  const updateProject = (index: number, field: string, value: any) => {
    updateResume((prev) => {
      const projects = [...(prev.projects || [])];
      projects[index] = { ...projects[index], [field]: value };
      return { ...prev, projects };
    });
  };

  const removeProject = (index: number) => {
    updateResume((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const basics = resume.basics || {};
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const work = Array.isArray(resume.work) ? resume.work : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Basics & Contact */}
      <div
        className="card"
        style={{
          padding: '1rem',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection('basics')}
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
            <User size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Basics & Contact</h4>
          </div>
          {openSections.basics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSections.basics && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '0.85rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
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
                  type="text"
                  value={basics.name || ''}
                  onChange={(e) => updateBasics('name', e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="input-text"
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Headline / Role Title
                </label>
                <input
                  type="text"
                  value={basics.label || ''}
                  onChange={(e) => updateBasics('label', e.target.value)}
                  placeholder="e.g. Senior Distributed Systems Engineer"
                  className="input-text"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={basics.email || ''}
                  onChange={(e) => updateBasics('email', e.target.value)}
                  placeholder="jane@example.com"
                  className="input-text"
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Phone
                </label>
                <input
                  type="text"
                  value={basics.phone || ''}
                  onChange={(e) => updateBasics('phone', e.target.value)}
                  placeholder="+1 (555) 012-3456"
                  className="input-text"
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Portfolio / Website URL
                </label>
                <input
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
                  type="text"
                  value={basics.location?.city || ''}
                  onChange={(e) => updateLocation('city', e.target.value)}
                  placeholder="San Francisco"
                  className="input-text"
                />
              </div>
              <div>
                <label
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
                  type="text"
                  value={basics.location?.region || ''}
                  onChange={(e) => updateLocation('region', e.target.value)}
                  placeholder="CA, United States"
                  className="input-text"
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Professional Summary
              </label>
              <textarea
                value={basics.summary || ''}
                onChange={(e) => updateBasics('summary', e.target.value)}
                placeholder="High-impact technical overview emphasizing your core competencies and accomplishments..."
                rows={3}
                className="input-text"
                style={{ resize: 'vertical', fontSize: '0.82rem' }}
              />
            </div>

            {/* Profiles / Links */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Social & Web Profiles
                </label>
                <button
                  type="button"
                  onClick={addProfile}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                >
                  <Plus size={12} /> Add Link
                </button>
              </div>

              {(basics.profiles || []).map((prof: any, pIdx: number) => (
                <div
                  key={pIdx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 140px 1fr auto',
                    gap: '0.5rem',
                    alignItems: 'center',
                    marginBottom: '0.4rem',
                  }}
                >
                  <input
                    type="text"
                    value={prof.network || ''}
                    onChange={(e) => updateProfile(pIdx, 'network', e.target.value)}
                    placeholder="e.g. GitHub"
                    className="input-text"
                    style={{ fontSize: '0.8rem' }}
                  />
                  <input
                    type="text"
                    value={prof.username || ''}
                    onChange={(e) => updateProfile(pIdx, 'username', e.target.value)}
                    placeholder="Username"
                    className="input-text"
                    style={{ fontSize: '0.8rem' }}
                  />
                  <input
                    type="url"
                    value={prof.url || ''}
                    onChange={(e) => updateProfile(pIdx, 'url', e.target.value)}
                    placeholder="https://..."
                    className="input-text"
                    style={{ fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeProfile(pIdx)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.2rem 0.4rem' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Skills & Tag Chips */}
      <div
        className="card"
        style={{
          padding: '1rem',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection('skills')}
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
            <Code size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Skills & Competencies ({skills.length} categories)
            </h4>
          </div>
          {openSections.skills ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSections.skills && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '0.85rem',
            }}
          >
            {skills.map((group: any, gIdx: number) => (
              <SkillGroupItem
                key={gIdx}
                group={group}
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
          </div>
        )}
      </div>

      {/* 3. Work Experience */}
      <div
        className="card"
        style={{
          padding: '1rem',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection('work')}
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
            <Briefcase size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Work Experience ({work.length} roles)
            </h4>
          </div>
          {openSections.work ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSections.work && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '0.85rem',
            }}
          >
            {work.map((w: any, wIdx: number) => (
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
          </div>
        )}
      </div>

      {/* 4. Education */}
      <div
        className="card"
        style={{
          padding: '1rem',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection('education')}
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
            <GraduationCap size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Education ({education.length})
            </h4>
          </div>
          {openSections.education ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSections.education && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '0.85rem',
            }}
          >
            {education.map((edu: any, eIdx: number) => (
              <div
                key={eIdx}
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
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {edu.institution || `Education Entry #${eIdx + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEducation(eIdx)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.2rem 0.4rem' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Institution
                    </label>
                    <input
                      type="text"
                      value={edu.institution || ''}
                      onChange={(e) => updateEducation(eIdx, 'institution', e.target.value)}
                      placeholder="e.g. Stanford University"
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Degree / Study Type
                    </label>
                    <input
                      type="text"
                      value={edu.studyType || ''}
                      onChange={(e) => updateEducation(eIdx, 'studyType', e.target.value)}
                      placeholder="e.g. Bachelor of Science"
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: '0.6rem' }}
                >
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Field of Study / Major
                    </label>
                    <input
                      type="text"
                      value={edu.area || ''}
                      onChange={(e) => updateEducation(eIdx, 'area', e.target.value)}
                      placeholder="Computer Science"
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Start Date
                    </label>
                    <input
                      type="text"
                      value={edu.startDate || ''}
                      onChange={(e) => updateEducation(eIdx, 'startDate', e.target.value)}
                      placeholder="2018-09"
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      End Date
                    </label>
                    <input
                      type="text"
                      value={edu.endDate || ''}
                      onChange={(e) => updateEducation(eIdx, 'endDate', e.target.value)}
                      placeholder="2022-06"
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>
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
          </div>
        )}
      </div>

      {/* 5. Projects */}
      <div
        className="card"
        style={{
          padding: '1rem',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection('projects')}
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
            <FolderGit2 size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Projects ({projects.length})
            </h4>
          </div>
          {openSections.projects ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSections.projects && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '0.85rem',
            }}
          >
            {projects.map((proj: any, pIdx: number) => (
              <div
                key={pIdx}
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
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {proj.name || `Project #${pIdx + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProject(pIdx)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.2rem 0.4rem' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={proj.name || ''}
                      onChange={(e) => updateProject(pIdx, 'name', e.target.value)}
                      placeholder="e.g. Distributed Consensus Engine"
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Project URL
                    </label>
                    <input
                      type="url"
                      value={proj.url || ''}
                      onChange={(e) => updateProject(pIdx, 'url', e.target.value)}
                      placeholder="https://github.com/..."
                      className="input-text"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Description
                  </label>
                  <textarea
                    value={proj.description || ''}
                    onChange={(e) => updateProject(pIdx, 'description', e.target.value)}
                    placeholder="Short description of the problem solved and technologies used..."
                    rows={2}
                    className="input-text"
                    style={{ resize: 'vertical', fontSize: '0.82rem' }}
                  />
                </div>
              </div>
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
          </div>
        )}
      </div>
    </div>
  );
};

// --- Subcomponents for Clean Rendering ---

const SkillGroupItem: React.FC<{
  group: any;
  onUpdateName: (name: string) => void;
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kIdx: number) => void;
  onRemoveGroup: () => void;
}> = ({ group, onUpdateName, onAddKeyword, onRemoveKeyword, onRemoveGroup }) => {
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
        <input
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
            >
              ✕
            </button>
          </span>
        ))}

        <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <input
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
  work: any;
  workIndex: number;
  onUpdate: (field: string, val: any) => void;
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
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Company Name</label>
          <input
            type="text"
            value={work.name || ''}
            onChange={(e) => onUpdate('name', e.target.value)}
            placeholder="e.g. Acme Corp"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role / Title</label>
          <input
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
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start Date</label>
          <input
            type="text"
            value={work.startDate || ''}
            onChange={(e) => onUpdate('startDate', e.target.value)}
            placeholder="YYYY-MM (e.g. 2021-03)"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            End Date (leave blank or 'Present' if current)
          </label>
          <input
            type="text"
            value={work.endDate || ''}
            onChange={(e) => onUpdate('endDate', e.target.value)}
            placeholder="YYYY-MM or Present"
            className="input-text"
            style={{ fontSize: '0.82rem' }}
          />
        </div>
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
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem' }}>
          <input
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
