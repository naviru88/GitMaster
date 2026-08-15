// ==================== GitHub Types ====================

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
  } | null;
  html_url: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  user: {
    login: string;
  } | null;
  merged_at: string | null;
  labels: {
    name: string;
  }[];
  html_url: string;
}

// ==================== App Types ====================

export type Category =
  | 'Features'
  | 'Bug Fixes'
  | 'Breaking Changes'
  | 'Improvements'
  | 'Chores/Internal'
  | 'Documentation'
  | 'Uncategorized';

export type Voice = 'developer' | 'marketing';

export type ChangelogStatus = 'draft' | 'published';

export interface RawChange {
  type: 'commit' | 'pr';
  sha?: string;
  prNumber?: number;
  title: string;
  body?: string;
  author: string;
  date: string;
  labels?: string[];
  conventionalPrefix?: string;
  category: Category;
}

export interface CategorizedChanges {
  categories: Record<Category, RawChange[]>;
  total: number;
}

// ==================== Project Types ====================

export interface Project {
  id: string;
  name: string;
  owner: string;
  repo: string;
  githubUrl: string;
  description: string | null;
  accessToken: string | null;
  stars: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    changelogs: number;
  };
}

export interface ProjectInput {
  githubUrl: string;
  accessToken?: string;
}

// ==================== Changelog Types ====================

export interface Changelog {
  id: string;
  projectId: string;
  version: string | null;
  fromRef: string;
  toRef: string;
  voice: Voice;
  status: ChangelogStatus;
  rawChanges: string;
  draftMarkdown: string;
  finalMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Project;
}

export interface GenerateChangelogInput {
  projectId: string;
  fromRef: string;
  toRef: string;
  voice: Voice;
  includePRs?: boolean;
}

// ==================== View Types ====================

export type AppView =
  | 'dashboard'
  | 'project'
  | 'new-changelog'
  | 'edit-changelog'
  | 'view-changelog'
  | 'running-changelog';

// ==================== Category Meta ====================

export const CATEGORY_META: Record<
  Category,
  { color: string; icon: string; description: string }
> = {
  Features: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: '✨', description: 'New features and functionality' },
  'Bug Fixes': { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '🐛', description: 'Bug fixes and patches' },
  'Breaking Changes': { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: '⚠️', description: 'Breaking changes requiring migration' },
  Improvements: { color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400', icon: '⚡', description: 'Performance and UX improvements' },
  'Chores/Internal': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', icon: '🔧', description: 'Internal refactors, CI, tooling' },
  Documentation: { color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400', icon: '📝', description: 'Documentation changes' },
  Uncategorized: { color: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400', icon: '❓', description: 'Could not be categorized' },
};

export const VOICE_META: Record<
  Voice,
  { label: string; description: string; icon: string }
> = {
  developer: {
    label: 'Developer',
    description: 'Technical, terse, for engineers. Assumes full context.',
    icon: '🛠️',
  },
  marketing: {
    label: 'Marketing',
    description: 'Plain language, benefit-framed. Hides internal details.',
    icon: '📣',
  },
};

export const CATEGORIES: Category[] = [
  'Features',
  'Bug Fixes',
  'Breaking Changes',
  'Improvements',
  'Chores/Internal',
  'Documentation',
  'Uncategorized',
];
