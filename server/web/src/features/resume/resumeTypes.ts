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

export const STARTER_RESUME_TEMPLATE: ResumeData = {
  $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
  basics: {
    name: 'Your Name',
    label: 'Software Engineer',
    email: 'you@example.com',
    phone: '+1 555-0100',
    url: 'https://example.com',
    summary: 'Experienced developer specializing in scalable distributed systems.',
    location: { city: 'San Francisco', region: 'CA' },
  },
  skills: [
    { name: 'Languages', keywords: ['TypeScript', 'Python', 'Go', 'Rust'] },
    { name: 'Frameworks & Tools', keywords: ['React', 'Node.js', 'FastAPI', 'Docker'] },
  ],
  work: [
    {
      name: 'Tech Innovators Inc',
      position: 'Senior Backend Engineer',
      startDate: '2022-01-01',
      highlights: [
        'Engineered real-time data pipeline processing 50M events daily.',
        'Reduced query latency by 45% using Redis caching and index optimization.',
      ],
    },
  ],
};
