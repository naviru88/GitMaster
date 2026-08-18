/* ============================================================
   GitHub REST API Service — used server-side only
   ============================================================ */

const GITHUB_API = 'https://api.github.com';

function headers(token?: string, extra: Record<string, string> = {}) {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch<T>(url: string, token?: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(token), ...(init?.headers as Record<string, string> | undefined) },
  });

  if (res.status === 403 && !token) {
    throw new Error('RATE_LIMITED');
  }

  if (res.status === 403) {
    const body = await res.text().catch(() => '');
    if (body.includes('rate limit')) throw new Error('RATE_LIMITED_AUTH');
    throw new Error(`GitHub API 403: ${body.slice(0, 200)}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// -------- User / Validate --------
export async function getGitHubUser(token?: string) {
  return ghFetch<import('@/types').GitHubUser>(`${GITHUB_API}/user`, token);
}

export async function getPublicUser(username: string) {
  return ghFetch<import('@/types').GitHubUser>(`${GITHUB_API}/users/${username}`);
}

// -------- Repositories --------
export async function listRepos(token: string | undefined, username: string, page = 1, perPage = 30) {
  const url = username === '*'
    ? `${GITHUB_API}/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=owner`
    : `${GITHUB_API}/users/${username}/repos?sort=updated&per_page=${perPage}&page=${page}`;
  return ghFetch<import('@/types').GitHubRepo[]>(url, token);
}

export async function searchRepos(token: string | undefined, query: string, page = 1, perPage = 30) {
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
  return ghFetch<{ total_count: number; items: import('@/types').GitHubRepo[] }>(url, token);
}

export async function createRepo(
  token: string | undefined,
  opts: { name: string; description?: string; private?: boolean; autoInit?: boolean },
) {
  return ghFetch<import('@/types').GitHubCreateRepoResult>(`${GITHUB_API}/user/repos`, token, {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      description: opts.description || '',
      private: !!opts.private,
      auto_init: opts.autoInit !== false,
    }),
  });
}

export async function deleteRepo(token: string | undefined, owner: string, repo: string) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
}

// -------- Contents --------
export async function getContents(token: string | undefined, owner: string, repo: string, path: string, ref?: string) {
  let url: string;
  if (path) {
    const params = new URLSearchParams();
    if (ref) params.set('ref', ref);
    const qs = params.toString();
    url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${qs ? `?${qs}` : ''}`;
  } else {
    const params = new URLSearchParams();
    if (ref) params.set('ref', ref);
    const qs = params.toString();
    url = `${GITHUB_API}/repos/${owner}/${repo}/contents${qs ? `?${qs}` : ''}`;
  }
  return ghFetch<import('@/types').GitHubContent[]>(url, token);
}

export async function getFile(token: string | undefined, owner: string, repo: string, path: string, ref?: string) {
  const params = new URLSearchParams();
  if (ref) params.set('ref', ref);
  const qs = params.toString();
  return ghFetch<import('@/types').GitHubContent>(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${qs ? `?${qs}` : ''}`,
    token,
  );
}

export async function createOrUpdateFile(
  token: string | undefined,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
  branch?: string,
  isBase64?: boolean,
) {
  const body: Record<string, unknown> = {
    message,
    content: isBase64 ? content : Buffer.from(content).toString('base64'),
  };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;
  return ghFetch<import('@/types').GitHubCreateFileResult>(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    token,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export async function deleteFile(
  token: string | undefined,
  owner: string,
  repo: string,
  path: string,
  message: string,
  sha: string,
  branch?: string,
) {
  const body: Record<string, unknown> = { message, sha };
  if (branch) body.branch = branch;
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    { method: 'DELETE', headers: headers(token), body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

// -------- Branches --------
export async function listBranches(token: string | undefined, owner: string, repo: string, page = 1, perPage = 100) {
  return ghFetch<import('@/types').GitHubBranch[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`,
    token,
  );
}

export async function createBranch(token: string | undefined, owner: string, repo: string, branch: string, fromSha: string) {
  return ghFetch<{ ref: string; object: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }),
    },
  );
}

export async function getBranchSha(token: string | undefined, owner: string, repo: string, branch: string) {
  return ghFetch<{ object: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    token,
  );
}

// -------- Merge --------
export async function mergeBranches(
  token: string | undefined,
  owner: string,
  repo: string,
  base: string,
  head: string,
  commitMessage?: string,
) {
  return ghFetch<import('@/types').GitHubMergeResult>(
    `${GITHUB_API}/repos/${owner}/${repo}/merges`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        base,
        head,
        commit_message: commitMessage || `Merge ${head} into ${base}`,
      }),
    },
  );
}

// -------- Commits --------
export async function listCommits(token: string | undefined, owner: string, repo: string, sha?: string, page = 1, perPage = 30) {
  const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
  if (sha) params.set('sha', sha);
  return ghFetch<import('@/types').GitHubCommit[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?${params.toString()}`,
    token,
  );
}

// -------- Compare --------
export async function compareCommits(token: string | undefined, owner: string, repo: string, base: string, head: string) {
  return ghFetch<{
    status: string;
    ahead_by: number;
    behind_by: number;
    total_commits: number;
    commits: import('@/types').GitHubCommit[];
    files?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
  }>(`${GITHUB_API}/repos/${owner}/${repo}/compare/${base}...${head}`, token);
}
