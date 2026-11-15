export interface ThemeMetadata {
  slug: string;
  name: string;
  category: string;
  description: string;
  badges: string[];
  engine: 'folio' | 'resumed';
}

export const THEME_CATALOG: ThemeMetadata[] = [
  {
    slug: 'jsonresume-theme-folio',
    name: 'Folio',
    category: 'Engineering & Tech',
    description: 'Compact, print-optimized single-page PDF with unified contact bar.',
    badges: ['Single Page', 'ATS-Optimized'],
    engine: 'folio',
  },
  {
    slug: 'jsonresume-theme-stackoverflow',
    name: 'StackOverflow',
    category: 'Engineering & Tech',
    description: 'Developer standard layout modeled after StackOverflow profiles.',
    badges: ['Developer Classic', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-pro',
    name: 'Pro',
    category: 'Corporate & Executive',
    description: 'Typeset single-column serif résumé with clean section hierarchy.',
    badges: ['Executive', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-harvard-classic',
    name: 'Harvard Classic',
    category: 'Academic & Classic',
    description: 'Traditional academic and corporate standard with center masthead.',
    badges: ['Classic', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-jake-technical',
    name: 'Jake Technical',
    category: 'Engineering & Tech',
    description: 'The ubiquitous CS and developer single-page resume format.',
    badges: ['Engineering', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-awesome-professional',
    name: 'Awesome Professional',
    category: 'Modern',
    description: 'Clean modern typography with balanced margins and high readability.',
    badges: ['Modern', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-compact-developer',
    name: 'Compact Developer',
    category: 'Engineering & Tech',
    description: 'Dense, information-rich format suited for seasoned engineers.',
    badges: ['High Density', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-charter-serif',
    name: 'Charter Serif',
    category: 'Editorial',
    description: 'Warm, editorial styling built on Bitstream Charter typography.',
    badges: ['Editorial', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-diplomat-cv',
    name: 'Diplomat CV',
    category: 'Government & Policy',
    description: 'Refined, authoritative CV layout for diplomacy and public policy.',
    badges: ['Formal', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-ledger-professional',
    name: 'Ledger Professional',
    category: 'Finance & Operations',
    description: 'Structured, columnar layout ideal for accounting and finance.',
    badges: ['Structured', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-stewardship-cv',
    name: 'Stewardship',
    category: 'Leadership & Non-Profit',
    description: 'Clean, trust-inspiring format for mission-driven leadership.',
    badges: ['Leadership', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-europass-inspired',
    name: 'Europass Inspired',
    category: 'International',
    description: 'Modern interpretation of the European standard CV structure.',
    badges: ['European Standard', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-first-role',
    name: 'First Role',
    category: 'Early Career',
    description: 'Emphasis on education and projects for graduates and career-switchers.',
    badges: ['Early Career', 'ATS-Safe'],
    engine: 'resumed',
  },
  {
    slug: 'jsonresume-theme-academic-classic',
    name: 'Academic Classic',
    category: 'Academic & Classic',
    description: 'Comprehensive layout designed for publications, grants, and research.',
    badges: ['Academic', 'ATS-Safe'],
    engine: 'resumed',
  },
];

export function findThemeMetadata(slug: string): ThemeMetadata | undefined {
  return THEME_CATALOG.find((t) => t.slug === slug);
}
