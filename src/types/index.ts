/* ============================================================
   Shared Types — GitHub Repo Manager
   ============================================================ */

// ---------- Database ----------
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Account {
  id: string;
  label: string;
  username: string;
  avatarUrl: string | null;
  token: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountCreate = Pick<Account, 'label' | 'token'>;

// ---------- GitHub API responses ----------
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  public_repos: number;
  private_repos: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
    maintain?: boolean;
    triage?: boolean;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
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
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string | null;
  git_url: string | null;
  type: 'file' | 'dir';
  content?: string;       // base64, only for files when fetched individually
  encoding?: string;
}

export interface GitHubMergeResult {
  sha: string;
  merged: boolean;
  message: string;
}

// ---------- Merge conflict resolution ----------
/** Why a given path is flagged as a real conflict (both sides changed it
 * differently), as opposed to a change that only happened on one side
 * (which the merge auto-applies without asking). */
export type ConflictKind =
  | 'both-modified'      // both branches changed the file, to different content
  | 'modified-deleted'   // base modified it, head deleted it
  | 'deleted-modified'   // base deleted it, head modified it
  | 'both-added';        // both branches added the same path independently, with different content

export interface MergeConflictFile {
  path: string;
  kind: ConflictKind;
  /** Content at the common-ancestor commit. null if the file didn't exist there
   * (e.g. both branches added it independently). */
  ancestorContent: string | null;
  /** Content on the base (target) branch. null if base deleted the file. */
  baseContent: string | null;
  /** Content on the head (source) branch. null if head deleted the file. */
  headContent: string | null;
  /** True if any of the three versions above look like binary content — the
   * app can't offer a meaningful text diff/merge box for these, so they're
   * shown with guidance to resolve via a Pull Request or local git instead. */
  isBinary: boolean;
  /** True if a version is too large to safely fetch/display inline. Same
   * fallback as isBinary. */
  tooLarge: boolean;
}

export interface MergeConflictCheckResult {
  hasConflicts: boolean;
  mergeBaseSha: string;
  baseSha: string;
  headSha: string;
  /** Paths changed only on head — these get auto-applied to the merge with
   * no user input needed. */
  autoApplyPaths: string[];
  conflicts: MergeConflictFile[];
}

export interface MergeResolution {
  path: string;
  /** The resolved text content to commit for this path, or null to resolve
   * the conflict by deleting the file entirely (e.g. keeping one side's
   * deletion over the other side's edit). */
  content: string | null;
}

export interface MergeConflictResolveResult {
  sha: string;
  filesResolved: number;
  filesAutoApplied: number;
}

export interface GitHubCreateRepoResult {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
}

export interface GitHubCreateFileResult {
  content: GitHubContent & {
    commit: {
      sha: string;
      html_url: string;
      message: string;
    };
  };
}

// ---------- App Views ----------
export type AppView =
  | 'dashboard'
  | 'account-repos'
  | 'repo-detail'
  | 'file-editor'
  | 'ai-tools'
  | 'project'
  | 'new-changelog'
  | 'view-changelog'
  | 'edit-changelog';

export type RepoTab = 'files' | 'branches' | 'commits';

// ---------- File upload ----------
export interface FileUpload {
  file: File;
  path: string;        // relative path within repo
}

// ---------- GitHub PRs / tags ----------
export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  html_url: string;
  user: { login: string; avatar_url: string } | null;
  labels?: { name: string }[];
}

export interface GitHubTag {
  name: string;
  commit: { sha: string; url: string };
  zipball_url: string;
  tarball_url: string;
}

// ---------- Changelog generation ----------
export type Category =
  | 'Breaking Changes'
  | 'Features'
  | 'Bug Fixes'
  | 'Improvements'
  | 'Documentation'
  | 'Chores/Internal'
  | 'Uncategorized';

export const CATEGORIES: Category[] = [
  'Breaking Changes',
  'Features',
  'Bug Fixes',
  'Improvements',
  'Documentation',
  'Chores/Internal',
  'Uncategorized',
];

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  'Breaking Changes': { label: 'Breaking Changes', icon: '⚠️', color: 'bg-red-500/15 text-red-600 border-red-500/30' },
  Features: { label: 'Features', icon: '✨', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  'Bug Fixes': { label: 'Bug Fixes', icon: '🐛', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  Improvements: { label: 'Improvements', icon: '⚡', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  Documentation: { label: 'Documentation', icon: '📝', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  'Chores/Internal': { label: 'Chores/Internal', icon: '🔧', color: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
  Uncategorized: { label: 'Uncategorized', icon: '📦', color: 'bg-gray-500/15 text-gray-600 border-gray-500/30' },
};

export type Voice = 'developer' | 'marketing';

export const VOICE_META: Record<Voice, { label: string; icon: string; description: string }> = {
  developer: { label: 'Developer', icon: '👨‍💻', description: 'Technical, concise, conventional-commit style' },
  marketing: { label: 'Marketing', icon: '📣', description: 'User-facing, benefit-focused prose' },
};

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

// ---------- Projects & Changelogs (DB-backed) ----------
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
  _count?: { changelogs: number };
}

export interface Changelog {
  id: string;
  fromRef: string;
  toRef: string;
  voice: Voice;
  status: 'draft' | 'published';
  rawChanges: string;
  draftMarkdown: string;
  finalMarkdown: string | null;
  version: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  project?: Project;
}
