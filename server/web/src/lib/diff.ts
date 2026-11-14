export interface DiffItem {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface WorkDiff {
  company: string;
  position: string;
  highlights: DiffItem[];
}

export interface SkillDiff {
  name: string;
  keywords: DiffItem[];
}

export interface ProjectDiff {
  name: string;
  isOmitted?: boolean;
  descriptionChange?: { original: string; tailored: string };
  highlights: DiffItem[];
  keywords: DiffItem[];
}

export interface ResumeDiff {
  basics: {
    labelChange?: { original: string; tailored: string };
    summaryChange?: { original: string; tailored: string };
  };
  work: WorkDiff[];
  skills: SkillDiff[];
  projects: ProjectDiff[];
}

export function computeListDiff(
  originalList: string[] = [],
  tailoredList: string[] = []
): DiffItem[] {
  const originalSet = new Set(originalList);
  const tailoredSet = new Set(tailoredList);
  const items: DiffItem[] = [];

  // Tailored items (added or unchanged)
  for (const item of tailoredList) {
    if (originalSet.has(item)) {
      items.push({ type: 'unchanged', text: item });
    } else {
      items.push({ type: 'added', text: item });
    }
  }

  // Original items that were removed
  for (const item of originalList) {
    if (!tailoredSet.has(item)) {
      items.push({ type: 'removed', text: item });
    }
  }

  return items;
}

export function computeResumeDiff(
  original: Record<string, any> = {},
  tailored: Record<string, any> = {}
): ResumeDiff {
  const origBasics = original.basics || {};
  const tailBasics = tailored.basics || {};

  const basics: ResumeDiff['basics'] = {};

  if (origBasics.label !== tailBasics.label) {
    basics.labelChange = {
      original: origBasics.label || '',
      tailored: tailBasics.label || '',
    };
  }

  if (origBasics.summary !== tailBasics.summary) {
    basics.summaryChange = {
      original: origBasics.summary || '',
      tailored: tailBasics.summary || '',
    };
  }

  // Work Diff
  const origWork: any[] = original.work || [];
  const tailWork: any[] = tailored.work || [];

  const work: WorkDiff[] = [];
  const allCompanies = Array.from(
    new Set([
      ...origWork.map((w) => w.company || w.name),
      ...tailWork.map((w) => w.company || w.name),
    ])
  ).filter(Boolean);

  for (const company of allCompanies) {
    const origRole = origWork.find((w) => (w.company || w.name) === company);
    const tailRole = tailWork.find((w) => (w.company || w.name) === company);

    const origHighlights: string[] = origRole?.highlights || [];
    const tailHighlights: string[] = tailRole?.highlights || [];

    const highlightsDiff = computeListDiff(origHighlights, tailHighlights);

    work.push({
      company,
      position: tailRole?.position || origRole?.position || '',
      highlights: highlightsDiff,
    });
  }

  // Skills Diff
  const origSkills: any[] = original.skills || [];
  const tailSkills: any[] = tailored.skills || [];

  const skills: SkillDiff[] = [];
  const allCategories = Array.from(
    new Set([...origSkills.map((s) => s.name), ...tailSkills.map((s) => s.name)])
  ).filter(Boolean);

  for (const category of allCategories) {
    const origCat = origSkills.find((s) => s.name === category);
    const tailCat = tailSkills.find((s) => s.name === category);

    const origKeywords: string[] = origCat?.keywords || [];
    const tailKeywords: string[] = tailCat?.keywords || [];

    const keywordsDiff = computeListDiff(origKeywords, tailKeywords);

    skills.push({
      name: category,
      keywords: keywordsDiff,
    });
  }

  // Projects Diff
  const origProjects: any[] = original.projects || [];
  const tailProjects: any[] = tailored.projects || [];

  const projects: ProjectDiff[] = [];
  const tailNames = new Set(tailProjects.map((p) => p.name).filter(Boolean));
  const allProjectNames = [
    ...tailProjects.map((p) => p.name).filter(Boolean),
    ...origProjects.map((p) => p.name).filter((name) => Boolean(name) && !tailNames.has(name)),
  ];

  for (const name of allProjectNames) {
    const origProj = origProjects.find((p) => p.name === name);
    const tailProj = tailProjects.find((p) => p.name === name);

    const isOmitted = Boolean(origProj && !tailProj);

    let descriptionChange: { original: string; tailored: string } | undefined;
    if (
      origProj?.description &&
      tailProj?.description &&
      origProj.description.trim() !== tailProj.description.trim()
    ) {
      descriptionChange = {
        original: origProj.description.trim(),
        tailored: tailProj.description.trim(),
      };
    }

    const origHighlights: string[] = origProj?.highlights || [];
    const tailHighlights: string[] = tailProj?.highlights || [];
    const highlightsDiff = computeListDiff(origHighlights, tailHighlights);

    const origKeywords: string[] = origProj?.keywords || [];
    const tailKeywords: string[] = tailProj?.keywords || [];
    const keywordsDiff = computeListDiff(origKeywords, tailKeywords);

    projects.push({
      name,
      isOmitted,
      descriptionChange,
      highlights: highlightsDiff,
      keywords: keywordsDiff,
    });
  }

  return { basics, work, skills, projects };
}
