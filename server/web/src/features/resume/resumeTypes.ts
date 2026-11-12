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
