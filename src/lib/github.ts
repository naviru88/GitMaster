//GitHub REST API Service — used server-side only

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//ghFetch retries transient rate-limit responses instead of failingimmediately.
async function ghFetch<T>(url: string, token?: string, init?: RequestInit, retriesLeft = 4): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(token), ...(init?.headers as Record<string, string> | undefined) },
  });

  if (res.status === 403 || res.status === 429) {
    const retryAfterHeader = res.headers.get('retry-after');
    const remaining = res.headers.get('x-ratelimit-remaining');
    const resetHeader = res.headers.get('x-ratelimit-reset');
    const errBody = await res.text().catch(() => '');
    const isSecondary = res.status === 429 || /secondary rate limit|abuse detection/i.test(errBody);
    const isPrimary = remaining === '0';

    if (!token && !isSecondary && !isPrimary) {
      throw new Error('RATE_LIMITED');
    }

    if ((isSecondary || isPrimary) && retriesLeft > 0) {
      let waitMs: number;
      if (retryAfterHeader) {
        waitMs = parseInt(retryAfterHeader, 10) * 1000;
      } else if (isPrimary && resetHeader) {
        waitMs = Math.max(1000, parseInt(resetHeader, 10) * 1000 - Date.now());
      } else {
        // Exponential backoff with jitter when GitHub didn't tell us exactly how long to wait.
        waitMs = (5 - retriesLeft) * 1500 + Math.random() * 500;
      }
      // Cap the wait so a batch of blob uploads can't individually stall past the server function's own timeout.
      waitMs = Math.min(waitMs, 15000);
      await sleep(waitMs);
      return ghFetch<T>(url, token, init, retriesLeft - 1);
    }

    if (!token) throw new Error('RATE_LIMITED');
    if (isSecondary || isPrimary) throw new Error('RATE_LIMITED_AUTH');
    throw new Error(`GitHub API 403: ${errBody.slice(0, 200)}`);
  }

  // Read the body once, regardless of status.
  const body = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }

  return (body ? JSON.parse(body) : undefined) as T;
}

// User / Validate
export async function getGitHubUser(token?: string) {
  return ghFetch<import('@/types').GitHubUser>(`${GITHUB_API}/user`, token);
}

export async function getPublicUser(username: string) {
  return ghFetch<import('@/types').GitHubUser>(`${GITHUB_API}/users/${username}`);
}

//Repositories
export async function listRepos(token: string | undefined, username: string, page = 1, perPage = 30) {
  const url = username === '*'
    ? `${GITHUB_API}/user/repos?sort=updated&per_page=${perPage}&page=${page}&affiliation=owner,collaborator,organization_member`
    : `${GITHUB_API}/users/${username}/repos?sort=updated&per_page=${perPage}&page=${page}`;
  return ghFetch<import('@/types').GitHubRepo[]>(url, token);
}

export async function searchRepos(token: string | undefined, query: string, page = 1, perPage = 30) {
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
  return ghFetch<{ total_count: number; items: import('@/types').GitHubRepo[] }>(url, token);
}

//Search repos the account can actually access
export async function searchAccessibleRepos(
  token: string,
  query: string,
  page = 1,
  perPage = 30,
): Promise<{ items: import('@/types').GitHubRepo[]; totalCount: number }> {
  const MAX_UPSTREAM_PAGES = 5;
  const q = query.trim().toLowerCase();
  let all: import('@/types').GitHubRepo[] = [];
  for (let p = 1; p <= MAX_UPSTREAM_PAGES; p++) {
    const batch = await ghFetch<import('@/types').GitHubRepo[]>(
      `${GITHUB_API}/user/repos?sort=updated&per_page=100&page=${p}&affiliation=owner,collaborator,organization_member`,
      token,
    );
    all = all.concat(batch);
    if (batch.length < 100) break; // upstream ran out of pages
  }
  const matched = q
    ? all.filter((r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q))
    : all;
  const start = (page - 1) * perPage;
  return { items: matched.slice(start, start + perPage), totalCount: matched.length };
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
  await ghFetch<void>(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token,
    { method: 'DELETE' },
  );
}

export async function updateRepoVisibility(
  token: string | undefined,
  owner: string,
  repo: string,
  isPrivate: boolean,
) {
  return ghFetch<import('@/types').GitHubRepo>(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ private: isPrivate }),
    },
  );
}

export async function updateRepoDescription(
  token: string | undefined,
  owner: string,
  repo: string,
  description: string,
) {
  return ghFetch<import('@/types').GitHubRepo>(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ description }),
    },
  );
}

export async function updateRepoName(
  token: string | undefined,
  owner: string,
  repo: string,
  name: string,
) {
  return ghFetch<import('@/types').GitHubRepo>(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );
}

// Contents
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
  owner: string, repo: string, path: string, content: string, message: string,
  sha?: string, branch?: string, isBase64?: boolean,
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
  token: string | undefined, owner: string, repo: string, path: string, message: string,
  sha: string, branch?: string,
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

// Branches
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
    { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }) },
  );
}

export async function getBranchSha(token: string | undefined, owner: string, repo: string, branch: string) {
  return ghFetch<{ object: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    token,
  );
}

export async function deleteBranch(token: string | undefined, owner: string, repo: string, branch: string) {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: 'DELETE',
      headers: headers(token),
    },
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
}

export async function renameBranch(token: string | undefined, owner: string, repo: string, oldName: string, newName: string) {
  try {
    return await ghFetch<import('@/types').GitHubBranch>(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(oldName)}/rename`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ new_name: newName }),
      },
    );
  } catch (err) {
    // Only fall back for GitHub installations that do not expose the rename endpoint.
    if (!(err instanceof Error && /GitHub API 404\b/.test(err.message))) {
      throw err;
    }
    const shaRes = await getBranchSha(token, owner, repo, oldName);
    await createBranch(token, owner, repo, newName, shaRes.object.sha);
    await deleteBranch(token, owner, repo, oldName);
    return { name: newName, commit: { sha: shaRes.object.sha, url: '' }, protected: false };
  }
}

//Merge
export async function mergeBranches(
  token: string | undefined, owner: string, repo: string, base: string, head: string,
  commitMessage?: string,
) {
  const result = await ghFetch<import('@/types').GitHubMergeResult | undefined>(
    `${GITHUB_API}/repos/${owner}/${repo}/merges`,
    token,
    { method: 'POST', body: JSON.stringify({ base, head, commit_message: commitMessage || `Merge ${head} into ${base}` }) },
  );
  return result ?? {
    sha: '',
    merged: true,
    message: 'Branches were already merged.',
  };
}

// Merge conflict detection & resolution (Git Data API)
async function compareBranches(
  token: string | undefined, owner: string, repo: string, base: string, head: string,
) {
  return ghFetch<{
    merge_base_commit: { sha: string };
    files?: Array<{ filename: string; status: string; previous_filename?: string }>;
  }>(`${GITHUB_API}/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, token);
}

//above this size, don't fetch/display content inline
const CONFLICT_CONTENT_MAX_BYTES = 512 * 1024;

interface FileVersion { content: string | null; isBinary: boolean; tooLarge: boolean; }

//Fetch a file's content at a given ref via the Contents API.
async function getFileVersion(
  token: string | undefined, owner: string, repo: string, path: string, ref: string,
): Promise<FileVersion> {
  let file: import('@/types').GitHubContent;
  try {
    file = await ghFetch<import('@/types').GitHubContent>(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
      token,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('GitHub API 404')) {
      return { content: null, isBinary: false, tooLarge: false };
    }
    throw err;
  }

  if (Array.isArray(file)) {
    // Path is a directory, not a file — shouldn't happen for a real conflict path, but guard against it rather than crash.
    return { content: null, isBinary: false, tooLarge: false };
  }
  // Empty files are valid text files and can still be part of a conflict.
  if (file.size > CONFLICT_CONTENT_MAX_BYTES || file.content === undefined) {
    return { content: null, isBinary: false, tooLarge: true };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(file.content, (file.encoding as BufferEncoding) || 'base64');
  } catch {
    return { content: null, isBinary: true, tooLarge: false };
  }
  if (buf.includes(0)) {
    return { content: null, isBinary: true, tooLarge: false };
  }
  try {
    return { content: new TextDecoder('utf-8', { fatal: true }).decode(buf), isBinary: false, tooLarge: false };
  } catch {
    return { content: null, isBinary: true, tooLarge: false };
  }
}

export async function checkMergeConflicts(
  token: string | undefined, owner: string, repo: string, base: string, head: string,
): Promise<import('@/types').MergeConflictCheckResult> {
  const [baseSha, headSha] = await Promise.all([
    getBranchSha(token, owner, repo, base).then((r) => r.object.sha),
    getBranchSha(token, owner, repo, head).then((r) => r.object.sha),
  ]);

  // Each direction's compare gives that branch's own changes since the shared ancestor — exactly the two sides of a 3-way merge.
  const [headSideCompare, baseSideCompare] = await Promise.all([
    compareBranches(token, owner, repo, base, head), // what head changed
    compareBranches(token, owner, repo, head, base), // what base changed
  ]);
  const mergeBaseSha = headSideCompare.merge_base_commit.sha;

  const headChanges = new Map((headSideCompare.files || []).map((f) => [f.filename, f]));
  const baseChanges = new Map((baseSideCompare.files || []).map((f) => [f.filename, f]));

  const autoApplyPaths: string[] = [];
  const overlapPaths: string[] = [];
  for (const path of headChanges.keys()) {
    if (baseChanges.has(path)) overlapPaths.push(path);
    else autoApplyPaths.push(path);
  }

  // Fetch the three versions of every overlapping path in parallel 
  const CONTENT_FETCH_CONCURRENCY = 6;
  const conflicts: import('@/types').MergeConflictFile[] = [];
  await runWithConcurrency(overlapPaths, CONTENT_FETCH_CONCURRENCY, async (path) => {
    const [ancestor, baseVer, headVer] = await Promise.all([
      getFileVersion(token, owner, repo, path, mergeBaseSha),
      getFileVersion(token, owner, repo, path, baseSha),
      getFileVersion(token, owner, repo, path, headSha),
    ]);

    // If both sides ended up with identical content
    if (baseVer.content !== null && baseVer.content === headVer.content) {
      autoApplyPaths.push(path);
      return;
    }

    let kind: import('@/types').ConflictKind;
    if (ancestor.content === null && baseVer.content !== null && headVer.content !== null) {
      kind = 'both-added';
    } else if (baseVer.content === null && headVer.content !== null) {
      kind = 'deleted-modified';
    } else if (baseVer.content !== null && headVer.content === null) {
      kind = 'modified-deleted';
    } else {
      kind = 'both-modified';
    }

    conflicts.push({
      path,
      kind,
      ancestorContent: ancestor.content,
      baseContent: baseVer.content,
      headContent: headVer.content,
      isBinary: ancestor.isBinary || baseVer.isBinary || headVer.isBinary,
      tooLarge: ancestor.tooLarge || baseVer.tooLarge || headVer.tooLarge,
    });
  });

  return {
    hasConflicts: conflicts.length > 0,
    mergeBaseSha,
    baseSha,
    headSha,
    autoApplyPaths,
    conflicts,
  };
}

export async function resolveMergeConflicts(
  token: string,
  owner: string,
  repo: string,
  base: string,
  head: string,
  message: string,
  autoApplyPaths: string[],
  resolutions: Array<{ path: string; content: string | null }>,
): Promise<import('@/types').MergeConflictResolveResult> {
  const [baseSha, headSha] = await Promise.all([
    getBranchSha(token, owner, repo, base).then((r) => r.object.sha),
    getBranchSha(token, owner, repo, head).then((r) => r.object.sha),
  ]);

  const baseCommit = await ghFetch<{ tree: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/commits/${baseSha}`,
    token,
  );

  type TreeEntry = { path: string; mode: '100644'; type: 'blob'; sha: string | null };

  // Auto-applied files: reference head's existing blob directly instead of re-uploading content we already know GitHub has
  const AUTO_APPLY_CONCURRENCY = 6;
  const autoEntries = await runWithConcurrency(autoApplyPaths, AUTO_APPLY_CONCURRENCY, async (path): Promise<TreeEntry> => {
    const file = await ghFetch<import('@/types').GitHubContent | null>(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(headSha)}`,
      token,
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('GitHub API 404')) return null; // deleted on head
      throw err;
    });
    if (!file || Array.isArray(file)) {
      return { path, mode: '100644', type: 'blob', sha: null }; // delete from the merge tree
    }
    return { path, mode: '100644', type: 'blob', sha: file.sha };
  });

  // Resolved conflicts: create a fresh blob for each resolution's content
  const RESOLUTION_CONCURRENCY = 3; // content-creating writes — see batchCommit's note on abuse detection
  const resolutionEntries = await runWithConcurrency(resolutions, RESOLUTION_CONCURRENCY, async (r): Promise<TreeEntry> => {
    if (r.content === null) {
      return { path: r.path, mode: '100644', type: 'blob', sha: null };
    }
    const blob = await ghFetch<{ sha: string }>(
      `${GITHUB_API}/repos/${owner}/${repo}/git/blobs`,
      token,
      { method: 'POST', body: JSON.stringify({ content: r.content, encoding: 'utf-8' }) },
    );
    return { path: r.path, mode: '100644', type: 'blob', sha: blob.sha };
  });

  const tree = await ghFetch<{ sha: string }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: [...autoEntries, ...resolutionEntries],
      }),
    },
  );

  const commit = await ghFetch<{ sha: string }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: tree.sha,
        // A genuine merge commit
        parents: [baseSha, headSha],
      }),
    },
  );

  await ghFetch<{ object: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${base}`,
    token,
    { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) },
  );

  return {
    sha: commit.sha,
    filesResolved: resolutionEntries.length,
    filesAutoApplied: autoEntries.length,
  };
}

//Commits
export async function listCommits(
  token: string | undefined, owner: string, repo: string, sha?: string, page = 1, perPage = 30, path?: string,
) {
  const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
  if (sha) params.set('sha', sha);
  if (path) params.set('path', path);
  return ghFetch<import('@/types').GitHubCommit[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?${params.toString()}`,
    token,
  );
}

// Compare
export async function compareCommits(token: string | undefined, owner: string, repo: string, base: string, head: string) {
  return ghFetch<{
    status: string; ahead_by: number; behind_by: number; total_commits: number;
    commits: import('@/types').GitHubCommit[];
    files?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
  }>(`${GITHUB_API}/repos/${owner}/${repo}/compare/${base}...${head}`, token);
}

// Batch Commit (Git Trees API)
interface BlobResult { sha: string; path: string; mode: string; type: string; }

//Run async tasks with a bounded concurrency
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

//Above this size, don't bother inlining even if it's valid text
const INLINE_MAX_BYTES = 512 * 1024;

//Try to treat a file's content as safe-to-inline UTF-8 text.
function tryInlineText(file: { content: string; isBase64: boolean }): string | null {
  let buf: Buffer;
  try {
    buf = file.isBase64 ? Buffer.from(file.content, 'base64') : Buffer.from(file.content, 'utf-8');
  } catch {
    return null;
  }
  if (buf.length === 0 || buf.length > INLINE_MAX_BYTES) return null;
  // A NUL byte is a strong binary signal that a "successful" UTF-8 decode alone won't always catch
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

export async function batchCommit(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string; isBase64: boolean }>,
  message: string,
  basePath: string = '',
) {
  // 1. Get current branch tip SHA
  const ref = await ghFetch<{ object: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    token,
  );
  const baseTreeSha = ref.object.sha;

  // 2. Split files into "inline" (small verified-text
  const inlineEntries: Array<{ path: string; mode: string; type: string; content: string }> = [];
  const blobCandidates: typeof files = [];
  for (const file of files) {
    const full = basePath ? `${basePath}/${file.path}` : file.path;
    const text = tryInlineText(file);
    if (text !== null) {
      inlineEntries.push({ path: full, mode: '100644', type: 'blob', content: text });
    } else {
      blobCandidates.push(file);
    }
  }

  // 3. Create blobs only for the files that couldn't be inlined.
  const BLOB_UPLOAD_CONCURRENCY = 3;
  const blobResults: BlobResult[] = await runWithConcurrency(blobCandidates, BLOB_UPLOAD_CONCURRENCY, async (file) => {
    const full = basePath ? `${basePath}/${file.path}` : file.path;
    const blob = await ghFetch<{ sha: string }>(
      `${GITHUB_API}/repos/${owner}/${repo}/git/blobs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          content: file.content,
          encoding: file.isBase64 ? 'base64' : 'utf-8',
        }),
      },
    );
    return { sha: blob.sha, path: full, mode: '100644', type: 'blob' } as BlobResult;
  });

  // 4. Create a new tree combining blob-referenced entries and inlined text-content entries.
  const tree = await ghFetch<{ sha: string }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          ...blobResults.map((b) => ({ path: b.path, mode: b.mode, type: b.type, sha: b.sha })),
          ...inlineEntries,
        ],
      }),
    },
  );

  // 5. Create a commit pointing to the new tree
  const commit = await ghFetch<{ sha: string }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [baseTreeSha],
      }),
    },
  );

  // 6. Update the branch reference
  await ghFetch<{ object: { sha: string } }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    },
  );

  return { sha: commit.sha, fileCount: blobResults.length + inlineEntries.length };
}

//Archive (Pull / Clone)
// Returns the download URL for a repo archive (zip or tar.gz)
export function getArchiveUrl(owner: string, repo: string, ref: string, format: 'zipball' | 'tarball' = 'zipball') {
  return `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${format}/${encodeURIComponent(ref)}`;
}

//Changelog generator support
export async function validateRepo(owner: string, repo: string, token?: string) {
  return ghFetch<import('@/types').GitHubRepo>(`${GITHUB_API}/repos/${owner}/${repo}`, token);
}

export async function fetchTags(owner: string, repo: string, token?: string, page = 1, perPage = 100) {
  return ghFetch<import('@/types').GitHubTag[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/tags?per_page=${perPage}&page=${page}`,
    token,
  );
}

export async function fetchCommitsBetween(
  owner: string, repo: string, fromRef: string, toRef: string, token?: string,
) {
  const result = await compareCommits(token, owner, repo, fromRef, toRef);
  return result.commits;
}

export async function fetchMergedPRs(
  owner: string, repo: string, fromDate: string, toDate: string, token?: string,
  page = 1, perPage = 50,
) {
  const params = new URLSearchParams({
    state: 'closed',
    per_page: String(perPage),
    page: String(page),
    sort: 'updated',
    direction: 'desc',
  });
  const prs = await ghFetch<import('@/types').GitHubPR[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?${params.toString()}`,
    token,
  );
  return prs.filter((pr) => {
    if (!pr.merged_at) return false;
    return pr.merged_at >= fromDate && pr.merged_at <= toDate;
  });
}
