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
    // Deletes every file under a folder path, one commit per file, via
    // repeated deleteFile calls. GitHub's Contents API has no concept of a
    // "folder" as a real object (git only tracks files/blobs), so there's
    // no single endpoint to delete a directory — this is the closest
    // equivalent: list everything under the path, then remove each file.
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
    // -------- Conflict detection & in-app resolution --------
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
