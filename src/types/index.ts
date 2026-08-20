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
  | 'ai-tools';

export type RepoTab = 'files' | 'branches' | 'commits';

// ---------- File upload ----------
export interface FileUpload {
  file: File;
  path: string;        // relative path within repo
}
