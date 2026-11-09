const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const locationText = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location.trim();
  return [location.city, location.region, location.countryCode].filter(Boolean).join(', ');
};

const dateRange = (start, end) => [start, end].filter(Boolean).join(' – ');

/**
 * Render a JSON Resume document as portable Markdown.
 *
 * Only fields present in the resume are emitted so tailored variants stay faithful
 * to the source document.
 *
 * @param {object} resume - JSON Resume object.
 * @returns {string} Markdown document.
 */
export function renderResumeMarkdown(resume = {}) {
  const basics = resume.basics || {};
  const lines = [];

  if (asText(basics.name)) lines.push(`# ${asText(basics.name)}`);
  if (asText(basics.label)) lines.push(`**${asText(basics.label)}**`);

  const contact = [basics.email, basics.phone, locationText(basics.location), basics.url]
    .map(asText)
    .filter(Boolean)
    .join(' · ');
  if (contact) lines.push(contact);

  if (asText(basics.summary)) {
    lines.push('', '## Summary', '', asText(basics.summary));
  }

  const work = asArray(resume.work);
  if (work.length) {
    lines.push('', '## Experience');
    for (const role of work) {
      const heading = [asText(role.position), asText(role.name) || asText(role.company)]
        .filter(Boolean)
        .join(' at ');
      lines.push('', `### ${heading || 'Role'}`);
      const meta = [dateRange(role.startDate, role.endDate), asText(role.location)]
        .filter(Boolean)
        .join(' · ');
      if (meta) lines.push(`_${meta}_`);
      if (asText(role.summary)) lines.push('', asText(role.summary));
      for (const highlight of asArray(role.highlights).map(asText).filter(Boolean)) {
        lines.push(`- ${highlight}`);
      }
    }
  }

  const projects = asArray(resume.projects);
  if (projects.length) {
    lines.push('', '## Projects');
    for (const project of projects) {
      const name = asText(project.name) || 'Project';
      const description = asText(project.description);
      lines.push('', description ? `### ${name} — ${description}` : `### ${name}`);
      if (asText(project.url)) lines.push(asText(project.url));
      for (const highlight of asArray(project.highlights).map(asText).filter(Boolean)) {
        lines.push(`- ${highlight}`);
      }
      if (!asArray(project.highlights).length && asText(project.summary)) {
        lines.push(asText(project.summary));
      }
    }
  }

  const education = asArray(resume.education);
  if (education.length) {
    lines.push('', '## Education');
    for (const school of education) {
      const heading = [asText(school.studyType), asText(school.area)].filter(Boolean).join(' in ');
      const institution = asText(school.institution);
      lines.push(
        '',
        `### ${[heading, institution].filter(Boolean).join(', ') || 'Education'}`,
        dateRange(school.startDate, school.endDate)
          ? `_${dateRange(school.startDate, school.endDate)}_`
          : ''
      );
      if (asText(school.score)) lines.push(`Score: ${asText(school.score)}`);
      for (const course of asArray(school.courses).map(asText).filter(Boolean)) {
        lines.push(`- ${course}`);
      }
    }
  }

  const skills = asArray(resume.skills);
  if (skills.length) {
    lines.push('', '## Skills');
    for (const group of skills) {
      const name = asText(group.name);
      const keywords = asArray(group.keywords).map(asText).filter(Boolean).join(', ');
      if (name || keywords) lines.push(`- **${name || 'Skills'}**: ${keywords}`);
    }
  }

  const certificates = asArray(resume.certificates);
  if (certificates.length) {
    lines.push('', '## Certifications');
    for (const certificate of certificates) {
      const name = asText(certificate.name);
      if (!name) continue;
      const issuer = asText(certificate.issuer);
      const date = asText(certificate.date);
      lines.push(`- ${[name, issuer, date].filter(Boolean).join(' — ')}`);
    }
  }

  const languages = asArray(resume.languages);
  if (languages.length) {
    lines.push('', '## Languages');
    for (const language of languages) {
      const name = asText(language.language);
      const fluency = asText(language.fluency);
      if (name || fluency) lines.push(`- ${[name, fluency].filter(Boolean).join(' — ')}`);
    }
  }

  const awards = asArray(resume.awards);
  if (awards.length) {
    lines.push('', '## Awards');
    for (const award of awards) {
      const title = asText(award.title);
      const awarder = asText(award.awarder);
      if (title || awarder) lines.push(`- ${[title, awarder].filter(Boolean).join(' — ')}`);
    }
  }

  const markdown = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${markdown}\n`;
}
