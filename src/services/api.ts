/* ============================================================
   Typed API Client — used client-side
   ============================================================ */

import type {
  User,
  Account,
  AccountCreate,
  GitHubRepo,
  GitHubBranch,
  GitHubCommit,
  GitHubContent,
  GitHubCreateRepoResult,
  GitHubCreateFileResult,
  GitHubMergeResult,
  GitHubTag,
  Project,
  Changelog,
  CategorizedChanges,
  Voice,
} from '@/types';

const BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }
  return body as T;
}

async function get<T>(url: string) {
  return handleResponse<T>(await fetch(`${BASE}${url}`));
}

async function post<T>(url: string, body?: unknown) {
  return handleResponse<T>(
    await fetch(`${BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

async function put<T>(url: string, body?: unknown) {
  return handleResponse<T>(
    await fetch(`${BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

async function del<T>(url: string) {
  return handleResponse<T>(await fetch(`${BASE}${url}`, { method: 'DELETE' }));
}

// -------- Auth --------
export const auth = {
  register: (name: string, email: string, password: string) =>
    post<User>('/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    post<User>('/auth/login', { email, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post<{ success: boolean }>('/auth/logout'),
};

// -------- Accounts --------
export const accounts = {
  list: () => get<Account[]>(`/accounts`),
  create: (data: AccountCreate) => post<Account>(`/accounts`, data),
  remove: (id: string) => del<void>(`/accounts/${id}`),
};

// -------- GitHub Repos --------
export const github = {
  repos: {
    list: (accountId: string, page?: number) =>
      get<{ items: GitHubRepo[]; totalCount: number }>(`/github/repos?accountId=${accountId}&page=${page || 1}`),
    search: (accountId: string, query: string, page?: number) =>
      get<{ items: GitHubRepo[]; totalCount: number }>(`/github/repos?accountId=${accountId}&q=${encodeURIComponent(query)}&page=${page || 1}`),
    create: (accountId: string, opts: { name: string; description?: string; private?: boolean }) =>
      post<GitHubCreateRepoResult>(`/github/repos?accountId=${accountId}`, opts),
    delete: (accountId: string, owner: string, repo: string) =>
      del<void>(`/github/repos?accountId=${accountId}&owner=${owner}&repo=${repo}`),
  },

  contents: {
    list: (accountId: string, owner: string, repo: string, path: string, ref?: string) => {
      const params = new URLSearchParams({ accountId, owner, repo, path });
      if (ref) params.set('ref', ref);
      return get<GitHubContent[]>(`/github/contents?${params.toString()}`);
    },
    getFile: (accountId: string, owner: string, repo: string, path: string, ref?: string) => {
      const params = new URLSearchParams({ accountId, owner, repo, path, single: 'true' });
      if (ref) params.set('ref', ref);
      return get<GitHubContent>(`/github/contents?${params.toString()}`);
    },
    saveFile: (accountId: string, owner: string, repo: string, path: string, content: string, message: string, sha?: string, branch?: string, isBase64?: boolean) =>
      post<GitHubCreateFileResult>(`/github/contents?accountId=${accountId}`, { owner, repo, path, content, message, sha, branch, isBase64 }),
    deleteFile: (accountId: string, owner: string, repo: string, path: string, message: string, sha: string, branch?: string) =>
      post<void>(`/github/contents/delete?accountId=${accountId}`, { owner, repo, path, message, sha, branch }),
  },

  branches: {
    list: (accountId: string, owner: string, repo: string) =>
      get<GitHubBranch[]>(`/github/branches?accountId=${accountId}&owner=${owner}&repo=${repo}`),
    create: (accountId: string, owner: string, repo: string, branch: string, fromSha: string) =>
      post<void>(`/github/branches?accountId=${accountId}`, { owner, repo, branch, fromSha }),
  },

  commits: {
    list: (accountId: string, owner: string, repo: string, sha?: string, page?: number) => {
      const params = new URLSearchParams({ accountId, owner, repo });
      if (sha) params.set('sha', sha);
      if (page) params.set('page', String(page));
      return get<GitHubCommit[]>(`/github/commits?${params.toString()}`);
    },
  },

  merge: {
    merge: (accountId: string, owner: string, repo: string, base: string, head: string, message?: string) =>
      post<GitHubMergeResult>(`/github/merge?accountId=${accountId}`, { owner, repo, base, head, message }),
  },

  // -------- Push (batch commit) --------
  push: {
    batch: (
      accountId: string, owner: string, repo: string, branch: string,
      files: Array<{ path: string; content: string; isBase64: boolean }>,
      message: string, basePath?: string,
    ) =>
      post<{ success: boolean; sha: string; filesCommitted: number }>(
        `/github/push?accountId=${accountId}`,
        { owner, repo, branch, files, message, basePath },
      ),
  },

  // -------- Pull (archive download) --------
  pull: {
    download: (accountId: string, owner: string, repo: string, ref: string, format?: 'zip' | 'tar.gz') => {
      const params = new URLSearchParams({ accountId, owner, repo, ref, format: format || 'zip' });
      return fetch(`${BASE}/github/pull?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error('Failed to download archive');
        return r.blob();
      });
    },
  },
};

// -------- Changelog Projects --------
// NOTE: these back the standalone "Projects/Changelog" feature (wizard,
// ProjectView, DashboardView in layout/). That feature is not currently
// reachable from the app's navigation — these exist so the components
// compile, not because the feature is wired up yet.

export function validateRepo(data: { githubUrl: string; accessToken?: string }) {
  return post<{
    name: string;
    fullName: string;
    description: string | null;
    htmlUrl: string;
    stars: number;
    owner: { login: string; avatar_url: string };
  }>('/github/validate', data);
}

export function createProject(data: { githubUrl: string; accessToken?: string }) {
  return post<Project>('/projects', data);
}

export function getProjects() {
  return get<Project[]>('/projects');
}

export function getProject(id: string) {
  return get<Project>(`/projects/${id}`);
}

export function deleteProject(id: string) {
  return del<{ success: boolean }>(`/projects/${id}`);
}

export function getProjectChangelogs(id: string) {
  return get<Changelog[]>(`/projects/${id}/changelogs`);
}

export function getTags(owner: string, repo: string, accessToken?: string) {
  const params = new URLSearchParams({ owner, repo });
  if (accessToken) params.set('accessToken', accessToken);
  return get<GitHubTag[]>(`/github/tags?${params.toString()}`);
}

export function fetchChanges(data: { projectId: string; fromRef: string; toRef: string; includePRs?: boolean }) {
  return post<CategorizedChanges>('/github/fetch', data);
}

export function generateChangelog(data: {
  projectId: string; fromRef: string; toRef: string; voice: Voice; includePRs?: boolean;
}) {
  return post<Changelog>('/changelog/generate', data);
}

export function updateChangelog(id: string, data: { draftMarkdown?: string; status?: string; version?: string }) {
  return put<Changelog>(`/changelog/${id}`, data);
}

// -------- AI --------
export const ai = {
  commitMessage: (diff: string, context?: string) =>
    post<{ message: string }>(`/ai/commit-message`, { diff, context }),
  readme: (repoName: string, description: string, techStack?: string, files?: string[]) =>
    post<{ readme: string }>(`/ai/readme`, { repoName, description, techStack, files }),
};
