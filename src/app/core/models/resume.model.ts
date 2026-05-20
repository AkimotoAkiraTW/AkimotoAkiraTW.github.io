export interface ResumeData {
  name: string;
  title: string;
  summary: string;
  contact: ContactInfo;
  experience: Experience[];
  education: Education[];
  skills: SkillCategory[];
  certifications: Certification[];
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  location: string;
  website?: string;
  github?: string;
  linkedin?: string;
}

export interface Project {
  name: string;
  highlights: string[];
  tech?: string;
}

export interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
  highlights: string[];
  projects?: Project[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  url?: string;
}
