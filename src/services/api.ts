import type { Project, ProjectInput, GitHubTag, CategorizedChanges, Changelog, GenerateChangelogInput } from '@/types';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || body.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects');
  return handleResponse<Project[]>(response);
}

export async function createProject(data: ProjectInput): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(response);
}

export async function getProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  return handleResponse<Project>(response);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  return handleResponse<void>(response);
}

export async function getProjectChangelogs(projectId: string): Promise<Changelog[]> {
  const response = await fetch(`/api/projects/${projectId}/changelogs`);
  return handleResponse<Changelog[]>(response);
}

export async function validateRepo(data: { githubUrl: string; accessToken?: string }) {
  const response = await fetch('/api/github/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubUrl: data.githubUrl, accessToken: data.accessToken }),
  });
  return handleResponse(response);
}

export async function getTags(owner: string, repo: string, accessToken?: string): Promise<GitHubTag[]> {
  const params = new URLSearchParams({ owner, repo });
  if (accessToken) params.set('accessToken', accessToken);
  const response = await fetch(`/api/github/tags?${params.toString()}`);
  return handleResponse<GitHubTag[]>(response);
}

export async function fetchChanges(data: {
  projectId: string;
  fromRef: string;
  toRef: string;
  includePRs?: boolean;
}): Promise<CategorizedChanges> {
  const response = await fetch('/api/github/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<CategorizedChanges>(response);
}

export async function generateChangelog(data: GenerateChangelogInput): Promise<Changelog> {
  const response = await fetch('/api/changelog/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Changelog>(response);
}

export async function getChangelog(id: string): Promise<Changelog> {
  const response = await fetch(`/api/changelog/${id}`);
  return handleResponse<Changelog>(response);
}

export async function updateChangelog(
  id: string,
  data: { draftMarkdown?: string; status?: string; version?: string }
): Promise<Changelog> {
  const response = await fetch(`/api/changelog/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Changelog>(response);
}
