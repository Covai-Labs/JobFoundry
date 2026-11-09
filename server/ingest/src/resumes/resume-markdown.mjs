const asArray = (value) => (Array.isArray(value) ? value : []);
const asEntries = (value) =>
  asArray(value).filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
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
 * to the source document. Malformed or null entries are skipped instead of throwing.
 *
 * @param {object} resume - JSON Resume object.
 * @returns {string} Markdown document.
 */
export function renderResumeMarkdown(resume = {}) {
  const basics = resume?.basics && typeof resume.basics === 'object' ? resume.basics : {};
  const lines = [];

  if (asText(basics.name)) lines.push(`# ${asText(basics.name)}`);
  if (asText(basics.label)) lines.push(`**${asText(basics.label)}**`);

  const contact = [basics.email, basics.phone, locationText(basics.location), basics.url]
    .map(asText)
    .filter(Boolean)
    .join(' · ');
  if (contact) lines.push(contact);

  const profiles = asEntries(basics.profiles);
  if (profiles.length) {
    lines.push('', '## Profiles');
    for (const profile of profiles) {
      const network = asText(profile.network);
      const username = asText(profile.username);
      const url = asText(profile.url);
      const label = [network, username].filter(Boolean).join(': ');
      if (label || url) lines.push(`- ${[label, url].filter(Boolean).join(' — ')}`);
    }
  }

  if (asText(basics.summary)) {
    lines.push('', '## Summary', '', asText(basics.summary));
  }

  const work = asEntries(resume.work);
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

  const volunteer = asEntries(resume.volunteer);
  if (volunteer.length) {
    lines.push('', '## Volunteer');
    for (const role of volunteer) {
      const heading = [asText(role.position), asText(role.organization)]
        .filter(Boolean)
        .join(' at ');
      lines.push('', `### ${heading || 'Volunteer'}`);
      const meta = [dateRange(role.startDate, role.endDate), asText(role.url)]
        .filter(Boolean)
        .join(' · ');
      if (meta) lines.push(`_${meta}_`);
      if (asText(role.summary)) lines.push('', asText(role.summary));
      for (const highlight of asArray(role.highlights).map(asText).filter(Boolean)) {
        lines.push(`- ${highlight}`);
      }
    }
  }

  const projects = asEntries(resume.projects);
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

  const education = asEntries(resume.education);
  if (education.length) {
    lines.push('', '## Education');
    for (const school of education) {
      const heading = [asText(school.studyType), asText(school.area)].filter(Boolean).join(' in ');
      const institution = asText(school.institution);
      const meta = dateRange(school.startDate, school.endDate);
      const headingLine = [heading, institution].filter(Boolean).join(', ') || 'Education';
      lines.push('', `### ${headingLine}`);
      if (meta) lines.push(`_${meta}_`);
      if (asText(school.score)) lines.push(`Score: ${asText(school.score)}`);
      for (const course of asArray(school.courses).map(asText).filter(Boolean)) {
        lines.push(`- ${course}`);
      }
    }
  }

  const skills = asEntries(resume.skills);
  if (skills.length) {
    lines.push('', '## Skills');
    for (const group of skills) {
      const name = asText(group.name);
      const keywords = asArray(group.keywords).map(asText).filter(Boolean).join(', ');
      if (name || keywords) lines.push(`- **${name || 'Skills'}**: ${keywords}`);
    }
  }

  const certificates = asEntries(resume.certificates);
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

  const publications = asEntries(resume.publications);
  if (publications.length) {
    lines.push('', '## Publications');
    for (const publication of publications) {
      const name = asText(publication.name);
      if (!name) continue;
      const publisher = asText(publication.publisher);
      const date = asText(publication.releaseDate);
      lines.push(`- ${[name, publisher, date].filter(Boolean).join(' — ')}`);
      if (asText(publication.url)) lines.push(`  ${asText(publication.url)}`);
      if (asText(publication.summary)) lines.push(`  ${asText(publication.summary)}`);
    }
  }

  const languages = asEntries(resume.languages);
  if (languages.length) {
    lines.push('', '## Languages');
    for (const language of languages) {
      const name = asText(language.language);
      const fluency = asText(language.fluency);
      if (name || fluency) lines.push(`- ${[name, fluency].filter(Boolean).join(' — ')}`);
    }
  }

  const interests = asEntries(resume.interests);
  if (interests.length) {
    lines.push('', '## Interests');
    for (const interest of interests) {
      const name = asText(interest.name);
      const keywords = asArray(interest.keywords).map(asText).filter(Boolean).join(', ');
      if (name || keywords) lines.push(`- ${[name, keywords].filter(Boolean).join(': ')}`);
    }
  }

  const awards = asEntries(resume.awards);
  if (awards.length) {
    lines.push('', '## Awards');
    for (const award of awards) {
      const title = asText(award.title);
      const awarder = asText(award.awarder);
      if (title || awarder) lines.push(`- ${[title, awarder].filter(Boolean).join(' — ')}`);
    }
  }

  const references = asEntries(resume.references);
  if (references.length) {
    lines.push('', '## References');
    for (const reference of references) {
      const name = asText(reference.name);
      const quote = asText(reference.reference);
      if (name) lines.push('', `### ${name}`);
      if (quote) lines.push(quote);
    }
  }

  const markdown = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${markdown}\n`;
}
