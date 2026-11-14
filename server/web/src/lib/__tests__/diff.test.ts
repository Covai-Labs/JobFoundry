import { describe, it, expect } from 'vitest';
import { computeResumeDiff } from '../diff';

describe('computeResumeDiff', () => {
  const originalResume = {
    basics: {
      name: 'Alex Smith',
      label: 'Software Engineer',
      summary: 'General backend engineer with Python skills.',
    },
    work: [
      {
        company: 'Cloud Corp',
        position: 'Backend Dev',
        highlights: ['Maintained legacy Python 2 codebase', 'Built REST APIs in Flask'],
      },
    ],
    skills: [
      {
        name: 'Backend',
        keywords: ['Python', 'Flask', 'MySQL'],
      },
    ],
    projects: [
      {
        name: 'Project A',
        description: 'Old project description',
        highlights: ['Built MVP', 'Fixed bugs'],
        keywords: ['Python', 'SQLite'],
      },
      {
        name: 'Project B (Omitted)',
        description: 'Legacy internal tool',
        highlights: ['Maintained tool'],
        keywords: ['Bash'],
      },
    ],
  };

  const tailoredResume = {
    basics: {
      name: 'Alex Smith',
      label: 'Senior Distributed Systems Architect',
      summary:
        'Senior distributed systems engineer specializing in high-throughput Python and FastAPI microservices.',
    },
    work: [
      {
        company: 'Cloud Corp',
        position: 'Backend Dev',
        highlights: [
          'Architected high-throughput REST APIs in FastAPI',
          'Built REST APIs in Flask',
        ],
      },
    ],
    skills: [
      {
        name: 'Backend',
        keywords: ['Python', 'FastAPI', 'Flask', 'MySQL', 'Docker'],
      },
    ],
    projects: [
      {
        name: 'Project A',
        description: 'New focused project description for target role',
        highlights: ['Built MVP', 'Scaled to 10k RPS with FastAPI'],
        keywords: ['Python', 'FastAPI', 'Redis'],
      },
    ],
  };

  it('detects summary and label modifications in basics', () => {
    const diff = computeResumeDiff(originalResume, tailoredResume);
    expect(diff.basics.labelChange).toEqual({
      original: 'Software Engineer',
      tailored: 'Senior Distributed Systems Architect',
    });
    expect(diff.basics.summaryChange).toBeDefined();
  });

  it('detects added and removed work highlights', () => {
    const diff = computeResumeDiff(originalResume, tailoredResume);
    expect(diff.work).toHaveLength(1);
    const workDiff = diff.work[0];
    expect(workDiff.company).toBe('Cloud Corp');

    const addedHighlights = workDiff.highlights.filter((h) => h.type === 'added');
    const removedHighlights = workDiff.highlights.filter((h) => h.type === 'removed');
    const unchangedHighlights = workDiff.highlights.filter((h) => h.type === 'unchanged');

    expect(addedHighlights).toHaveLength(1);
    expect(addedHighlights[0].text).toContain('FastAPI');
    expect(removedHighlights).toHaveLength(1);
    expect(removedHighlights[0].text).toContain('Python 2');
    expect(unchangedHighlights).toHaveLength(1);
    expect(unchangedHighlights[0].text).toContain('Flask');
  });

  it('detects skill additions', () => {
    const diff = computeResumeDiff(originalResume, tailoredResume);
    const skillDiff = diff.skills[0];
    expect(skillDiff.name).toBe('Backend');
    const addedKeywords = skillDiff.keywords.filter((k) => k.type === 'added').map((k) => k.text);
    expect(addedKeywords).toContain('FastAPI');
    expect(addedKeywords).toContain('Docker');
  });

  it('detects project description modifications, highlight additions/removals, and keywords', () => {
    const diff = computeResumeDiff(originalResume, tailoredResume);
    const projA = diff.projects.find((p) => p.name === 'Project A');
    expect(projA).toBeDefined();
    expect(projA?.isOmitted).toBeFalsy();
    expect(projA?.descriptionChange).toEqual({
      original: 'Old project description',
      tailored: 'New focused project description for target role',
    });

    const addedHighlights = projA?.highlights.filter((h) => h.type === 'added').map((h) => h.text);
    const removedHighlights = projA?.highlights
      .filter((h) => h.type === 'removed')
      .map((h) => h.text);
    const unchangedHighlights = projA?.highlights
      .filter((h) => h.type === 'unchanged')
      .map((h) => h.text);

    expect(addedHighlights).toContain('Scaled to 10k RPS with FastAPI');
    expect(removedHighlights).toContain('Fixed bugs');
    expect(unchangedHighlights).toContain('Built MVP');

    const addedKeywords = projA?.keywords.filter((k) => k.type === 'added').map((k) => k.text);
    const removedKeywords = projA?.keywords.filter((k) => k.type === 'removed').map((k) => k.text);
    expect(addedKeywords).toContain('FastAPI');
    expect(addedKeywords).toContain('Redis');
    expect(removedKeywords).toContain('SQLite');
  });

  it('detects omitted projects from master resume', () => {
    const diff = computeResumeDiff(originalResume, tailoredResume);
    const projB = diff.projects.find((p) => p.name === 'Project B (Omitted)');
    expect(projB).toBeDefined();
    expect(projB?.isOmitted).toBe(true);
  });

  it('detects project description additions and removals', () => {
    const orig = {
      projects: [{ name: 'Proj 1', description: 'Has description' }, { name: 'Proj 2' }],
    };
    const tail = {
      projects: [{ name: 'Proj 1' }, { name: 'Proj 2', description: 'Newly added description' }],
    };

    const diff = computeResumeDiff(orig, tail);
    const p1 = diff.projects.find((p) => p.name === 'Proj 1');
    const p2 = diff.projects.find((p) => p.name === 'Proj 2');

    expect(p1?.descriptionChange).toEqual({
      original: 'Has description',
      tailored: '',
    });
    expect(p2?.descriptionChange).toEqual({
      original: '',
      tailored: 'Newly added description',
    });
  });

  it('handles unnamed projects and duplicate project names one-to-one', () => {
    const orig = {
      projects: [
        { description: 'Unnamed project 1', highlights: ['Bullet 1'] },
        { name: 'Duplicate Name', description: 'First duplicate', highlights: ['First'] },
        { name: 'Duplicate Name', description: 'Second duplicate', highlights: ['Second'] },
      ],
    };
    const tail = {
      projects: [
        { description: 'Unnamed project 1 rewritten', highlights: ['Bullet 1'] },
        { name: 'Duplicate Name', description: 'First duplicate tailored', highlights: ['First'] },
        {
          name: 'Duplicate Name',
          description: 'Second duplicate tailored',
          highlights: ['Second'],
        },
        { name: 'Brand New Project', description: 'Added project', highlights: ['New bullet'] },
      ],
    };

    const diff = computeResumeDiff(orig, tail);
    expect(diff.projects).toHaveLength(4);

    // Unnamed project matches at index 0
    expect(diff.projects[0].name).toBe('Project 1');
    expect(diff.projects[0].descriptionChange).toEqual({
      original: 'Unnamed project 1',
      tailored: 'Unnamed project 1 rewritten',
    });

    // First duplicate matches first
    expect(diff.projects[1].descriptionChange).toEqual({
      original: 'First duplicate',
      tailored: 'First duplicate tailored',
    });

    // Second duplicate matches second
    expect(diff.projects[2].descriptionChange).toEqual({
      original: 'Second duplicate',
      tailored: 'Second duplicate tailored',
    });

    // Brand new project added
    expect(diff.projects[3].name).toBe('Brand New Project');
    expect(diff.projects[3].isOmitted).toBe(false);
    expect(diff.projects[3].descriptionChange).toEqual({
      original: '',
      tailored: 'Added project',
    });
  });
});
