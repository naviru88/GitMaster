//yped API Client — used client-side

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
  MergeConflictCheckResult,
  MergeConflictResolveResult,
  Project,
  Changelog,
  CategorizedChanges,
  Voice,
} from '@/types';

const BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallbackByStatus: Record<number, string> = {
      400: 'Please check the values in the form and try again.',
      401: 'Your session has expired. Please sign in again.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested repository or resource could not be found.',
      409: 'This action conflicts with a newer change. Refresh and try again.',
      422: 'GitHub rejected the provided values. Please check them and try again.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'The server could not complete the request. Please try again.',
      502: 'GitHub is temporarily unavailable. Please try again shortly.',
    };
    throw new Error(body.error || body.message || fallbackByStatus[res.status] || 'The request could not be completed.');
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

async function patch<T>(url: string, body?: unknown) {
  return handleResponse<T>(
    await fetch(`${BASE}${url}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

async function del<T>(url: string) {
  return handleResponse<T>(await fetch(`${BASE}${url}`, { method: 'DELETE' }));
}

//Auth
export const auth = {
  register: (name: string, email: string, password: string) =>
    post<User>('/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    post<User>('/auth/login', { email, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post<{ success: boolean }>('/auth/logout'),
};

// Accounts
export const accounts = {
  list: () => get<Account[]>(`/accounts`),
  create: (data: AccountCreate) => post<Account>(`/accounts`, data),
  remove: (id: string) => del<void>(`/accounts/${id}`),
};

// GitHub Repos
export const github = {
  repos: {
    list: (accountId: string, page?: number) =>
      get<{ items: GitHubRepo[]; totalCount: number }>(`/github/repos?accountId=${accountId}&page=${page || 1}`),
    search: (accountId: string, query: string, page?: number) =>
      get<{ items: GitHubRepo[]; totalCount: number }>(`/github/repos?accountId=${accountId}&q=${encodeURIComponent(query)}&page=${page || 1}`),
    create: (accountId: string, opts: { name: string; description?: string; private?: boolean }) =>
      post<GitHubCreateRepoResult>(`/github/repos?accountId=${accountId}`, opts),
    delete: (accountId: string, owner: string, repo: string) => {
      const params = new URLSearchParams({ accountId, owner, repo });
      return del<{ success: boolean }>(`/github/repos?${params.toString()}`);
    },
    updateVisibility: (accountId: string, owner: string, repo: string, isPrivate: boolean) => {
      const params = new URLSearchParams({ accountId, owner, repo });
      return patch<GitHubRepo>(`/github/repos?${params.toString()}`, { private: isPrivate });
    },
    updateDescription: (accountId: string, owner: string, repo: string, description: string) => {
      const params = new URLSearchParams({ accountId, owner, repo });
      return patch<GitHubRepo>(`/github/repos?${params.toString()}`, { description });
    },
    updateName: (accountId: string, owner: string, repo: string, name: string) => {
      const params = new URLSearchParams({ accountId, owner, repo });
      return patch<GitHubRepo>(`/github/repos?${params.toString()}`, { name });
    },
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
      post<{ success: boolean }>(`/github/contents?accountId=${accountId}&action=delete`, { owner, repo, path, message, sha, branch }),
    download: (accountId: string, owner: string, repo: string, path: string, ref?: string) => {
      const params = new URLSearchParams({ accountId, owner, repo, path });
      if (ref) params.set('ref', ref);
      return fetch(`${BASE}/github/download?${params.toString()}`).then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || `Failed to download (${response.status})`);
        }
        return { blob: await response.blob(), filename: response.headers.get('content-disposition') || path.split('/').pop() || 'download' };
      });
    },
    // Deletes every file under a folder path, one commit per file.
    deleteFolder: async (
      accountId: string, owner: string, repo: string, folderPath: string, message: string, branch?: string,
      onProgress?: (done: number, total: number) => void,
    ) => {
      const files: { path: string; sha: string }[] = [];
      const collect = async (path: string) => {
        const entries = await github.contents.list(accountId, owner, repo, path, branch);
        for (const entry of entries) {
          if (entry.type === 'dir') {
            await collect(entry.path);
          } else {
            files.push({ path: entry.path, sha: entry.sha });
          }
        }
      };
      await collect(folderPath);
      for (let i = 0; i < files.length; i++) {
        await github.contents.deleteFile(accountId, owner, repo, files[i].path, message, files[i].sha, branch);
        onProgress?.(i + 1, files.length);
      }
      return { deletedCount: files.length };
    },
  },

  branches: {
    list: (accountId: string, owner: string, repo: string) =>
      get<GitHubBranch[]>(`/github/branches?accountId=${accountId}&owner=${owner}&repo=${repo}`),
    create: (accountId: string, owner: string, repo: string, branch: string, fromSha: string) =>
      post<void>(`/github/branches?accountId=${accountId}`, { owner, repo, branch, fromSha }),
    delete: (accountId: string, owner: string, repo: string, branch: string) => {
      const params = new URLSearchParams({ accountId, owner, repo, branch });
      return del<{ success: boolean }>(`/github/branches?${params.toString()}`);
    },
    rename: (accountId: string, owner: string, repo: string, oldName: string, newName: string) =>
      patch<{ success: boolean }>(`/github/branches?accountId=${accountId}`, { owner, repo, oldName, newName }),
  },

  commits: {
    list: (accountId: string, owner: string, repo: string, sha?: string, page?: number, path?: string) => {
      const params = new URLSearchParams({ accountId, owner, repo });
      if (sha) params.set('sha', sha);
      if (page) params.set('page', String(page));
      if (path) params.set('path', path);
      return get<GitHubCommit[]>(`/github/commits?${params.toString()}`);
    },
  },

  merge: {
    merge: (accountId: string, owner: string, repo: string, base: string, head: string, message?: string) =>
      post<GitHubMergeResult>(`/github/merge?accountId=${accountId}`, { owner, repo, base, head, message }),
    // Conflict detection & in-app resolution
    checkConflicts: (accountId: string, owner: string, repo: string, base: string, head: string) => {
      const params = new URLSearchParams({ accountId, owner, repo, base, head });
      return get<MergeConflictCheckResult>(`/github/merge-conflicts?${params.toString()}`);
    },
    resolveConflicts: (
      accountId: string, owner: string, repo: string, base: string, head: string,
      autoApplyPaths: string[], resolutions: Array<{ path: string; content: string | null }>, message?: string,
    ) =>
      post<MergeConflictResolveResult>(`/github/merge-conflicts?accountId=${accountId}`, {
        owner, repo, base, head, message, autoApplyPaths, resolutions,
      }),
  },

  // Push (batch commit)
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

  // Pull (archive download)
  pull: {
    download: (accountId: string, owner: string, repo: string, ref: string, format?: 'zip' | 'tar.gz') => {
      const params = new URLSearchParams({ accountId, owner, repo, ref, format: format || 'zip' });
      return fetch(`${BASE}/github/pull?${params.toString()}`).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error || `Failed to download archive (${r.status})`);
        }
        return r.blob();
      });
    },
  },
};

//Changelog Projects

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

//AI
export const ai = {
  commitMessage: (diff: string, context?: string) =>
    post<{ message: string }>(`/ai/commit-message`, { diff, context }),
  readme: (repoName: string, description: string, techStack?: string, files?: string[]) =>
    post<{ readme: string }>(`/ai/readme`, { repoName, description, techStack, files }),
};

// Releases
export interface ReleaseCommit {
  id: string;
  sha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: string | null;
  changeType: 'ADDED' | 'CHANGED' | 'FIXED' | 'REMOVED' | 'DEPRECATED' | 'SECURITY' | null;
  note: string | null;
  order: number;
}

export interface Release {
  id: string;
  projectId: string;
  version: string;
  level: 'MAJOR' | 'MINOR' | 'PATCH';
  title: string | null;
  description: string | null;
  releasedAt: string;
  published: boolean;
  parentId: string | null;
  order: number;
  commits: ReleaseCommit[];
  children: Release[];
}

export interface ReleaseListResponse {
  project: { id: string; name: string; fullName: string };
  tree: Release[];
  count: number;
}

export const releases = {
  async resolveProject(input: { owner: string; repo: string; githubUrl: string; name?: string }) {
    return post<{ id: string; name: string; owner: string; repo: string }>(
      '/releases/project',
      input,
    );
  },

  async list(projectId: string, opts?: { includeUnpublished?: boolean }) {
    const qs = opts?.includeUnpublished ? '?published=all' : '';
    return get<ReleaseListResponse>(`/projects/${projectId}/releases${qs}`);
  },

  async create(
    projectId: string,
    input: {
      version: string;
      title?: string;
      description?: string;
      releasedAt?: string;
      published?: boolean;
    },
  ) {
    return post<Release>(`/projects/${projectId}/releases`, input);
  },

  async get(releaseId: string) {
    return get<Release>(`/releases/${releaseId}`);
  },

  async update(
    releaseId: string,
    patch: {
      version?: string;
      title?: string | null;
      description?: string | null;
      releasedAt?: string;
      published?: boolean;
    },
  ) {
    return put<Release>(`/releases/${releaseId}`, patch);
  },

  async delete(releaseId: string) {
    return del<{
      deleted: boolean;
      version: string;
      cascadedChildren: number;
      cascadedCommits: number;
    }>(`/releases/${releaseId}`);
  },

  async attachCommit(
    releaseId: string,
    input: {
      sha: string;
      message: string;
      authorName?: string;
      authorEmail?: string;
      committedAt?: string;
      changeType?: ReleaseCommit['changeType'];
      note?: string;
      order?: number;
    },
  ) {
    return post<ReleaseCommit>(`/releases/${releaseId}/commits`, input);
  },

  async detachCommit(releaseId: string, commitId: string) {
    return del<{ deleted: boolean; sha: string }>(
      `/releases/${releaseId}/commits/${commitId}`,
    );
  },

  exportUrl(
    projectId: string,
    opts?: { format?: 'html'; disposition?: 'inline' | 'attachment'; theme?: 'light' | 'dark' | 'auto' },
  ) {
    const params = new URLSearchParams();
    params.set('format', opts?.format ?? 'html');
    if (opts?.disposition) params.set('disposition', opts.disposition);
    if (opts?.theme) params.set('theme', opts.theme);
    return `/api/projects/${projectId}/releases/export?${params.toString()}`;
  },
};
