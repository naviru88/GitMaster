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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ghFetch retries transient rate-limit responses instead of failing
 * immediately. GitHub has two distinct kinds of 403/429 here:
 *  - Primary rate limit: the normal per-hour quota (X-RateLimit-Remaining: 0),
 *    which tells us exactly when it resets via X-RateLimit-Reset.
 *  - Secondary/abuse rate limit: triggered by request *pattern* (e.g. too
 *    many concurrent writes to content-creation endpoints like blob
 *    creation), independent of quota. GitHub sends a Retry-After header (or
 *    puts the wait in the response body) and expects the client to back off
 *    and retry — it is NOT meant to be a hard failure.
 * Failing outright on the first hit (the old behavior) turned a brief,
 * self-correcting slowdown into a broken push. Retrying with the server-told
 * wait time (or a short exponential backoff as a fallback) fixes that.
 */
async function ghFetch<T>(url: string, token?: string, init?: RequestInit, retriesLeft = 4): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(token), ...(init?.headers as Record<string, string> | undefined) },
  });

  if (res.status === 403 || res.status === 429) {
    const retryAfterHeader = res.headers.get('retry-after');
    const remaining = res.headers.get('x-ratelimit-remaining');
    const resetHeader = res.headers.get('x-ratelimit-reset');
    const body = await res.text().catch(() => '');
    const isSecondary = res.status === 429 || /secondary rate limit|abuse detection/i.test(body);
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
        // Exponential backoff with jitter when GitHub didn't tell us exactly
        // how long to wait.
        waitMs = (5 - retriesLeft) * 1500 + Math.random() * 500;
      }
      // Cap the wait so a batch of blob uploads can't individually stall
      // past the server function's own timeout.
      waitMs = Math.min(waitMs, 15000);
      await sleep(waitMs);
      return ghFetch<T>(url, token, init, retriesLeft - 1);
    }

    if (!token) throw new Error('RATE_LIMITED');
    if (isSecondary || isPrimary) throw new Error('RATE_LIMITED_AUTH');
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
    { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }) },
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
  token: string | undefined, owner: string, repo: string, base: string, head: string,
  commitMessage?: string,
) {
  return ghFetch<import('@/types').GitHubMergeResult>(
    `${GITHUB_API}/repos/${owner}/${repo}/merges`,
    token,
    { method: 'POST', body: JSON.stringify({ base, head, commit_message: commitMessage || `Merge ${head} into ${base}` }) },
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
    status: string; ahead_by: number; behind_by: number; total_commits: number;
    commits: import('@/types').GitHubCommit[];
    files?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
  }>(`${GITHUB_API}/repos/${owner}/${repo}/compare/${base}...${head}`, token);
}

// -------- Batch Commit (Git Trees API) --------
// Creates a single commit with multiple file changes — equivalent to git add . && git commit && git push

interface BlobResult { sha: string; path: string; mode: string; type: string; }

/**
 * Run async tasks with a bounded concurrency instead of either fully
 * sequential (slow) or fully parallel (can trip GitHub's abuse/rate limits).
 */
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

/** Above this size, don't bother inlining even if it's valid text — keeps
 * the /trees request body from being dominated by one large file. */
const INLINE_MAX_BYTES = 512 * 1024;

/**
 * Try to treat a file's content as safe-to-inline UTF-8 text. Returns the
 * decoded text if so, or null if it should go through the blob-creation API
 * instead (binary content, or too large to be worth inlining).
 *
 * Why this matters for speed: GitHub's Trees API lets a tree entry carry its
 * `content` directly instead of a blob `sha` — GitHub creates the blob for
 * you as part of the same request. For a typical push (mostly source code,
 * config, docs — all text), this means most files need ZERO separate blob
 * HTTP round-trips at all, which is the single biggest lever available for
 * push speed without touching the concurrency limits that keep us under
 * GitHub's abuse-detection radar.
 */
function tryInlineText(file: { content: string; isBase64: boolean }): string | null {
  let buf: Buffer;
  try {
    buf = file.isBase64 ? Buffer.from(file.content, 'base64') : Buffer.from(file.content, 'utf-8');
  } catch {
    return null;
  }
  if (buf.length === 0 || buf.length > INLINE_MAX_BYTES) return null;
  // A NUL byte is a strong binary signal that a "successful" UTF-8 decode
  // alone won't always catch (some binary formats coincidentally decode as
  // valid UTF-8).
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

  // 2. Split files into "inline" (small verified-text — no blob call
  // needed) vs "blob" (binary, or too large to safely inline) groups. See
  // tryInlineText above for the rationale.
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
  // Blob creation is one HTTP round-trip per file — doing this strictly
  // sequentially is what was causing pushes of more than a couple dozen
  // files to be slow enough to fail (e.g. hit the serverless function's
  // maxDuration). Upload with bounded concurrency instead: fast, but capped
  // so we don't slam into GitHub's secondary rate limits on huge batches.
  // Blob creation is a content-generating write endpoint, and GitHub's own
  // API guidance specifically warns against concurrent requests to this
  // class of endpoint — doing so risks their *secondary* rate limit (abuse
  // detection), which is separate from and independent of the normal
  // per-hour quota. 10 (and even the previous 6) was too aggressive and was
  // tripping it. 3 is a safer balance of "still faster than fully serial"
  // vs. "won't get flagged as abusive traffic." Combined with the
  // retry/backoff in ghFetch above, an occasional secondary-limit hit now
  // self-heals instead of failing the whole push.
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

  // 4. Create a new tree combining blob-referenced entries and inlined
  // text-content entries.
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

// -------- Archive (Pull / Clone) --------
// Returns the download URL for a repo archive (zip or tar.gz)
export function getArchiveUrl(owner: string, repo: string, ref: string, format: 'zipball' | 'tarball' = 'zipball') {
  return `${GITHUB_API}/repos/${owner}/${repo}/${format}/${ref}`;
}

// -------- Changelog generator support --------
// NOTE: these take (owner, repo, ...args, token) — matching the call sites in
// the changelog/project API routes, which is the reverse of the (token, owner,
// repo, ...) convention used elsewhere in this file.

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
