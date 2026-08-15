import type { GitHubCommit, GitHubPR, RawChange } from '@/types';

const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|chore|docs|style|refactor|perf|test|ci|build|revert)(\(.+\))?!?:/;

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // Handle various formats:
  // https://github.com/owner/repo
  // http://github.com/owner/repo
  // github.com/owner/repo
  // owner/repo

  let cleaned = url.trim();

  // Remove trailing slashes and .git suffix
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.replace(/\.git$/, '');

  // Try to extract from URL format
  const urlMatch = cleaned.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/,
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Try owner/repo format
  const simpleMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (simpleMatch) {
    return { owner: simpleMatch[1], repo: simpleMatch[2] };
  }

  throw new Error(`Invalid GitHub URL or identifier: ${url}`);
}

export function normalizeChanges(
  commits: GitHubCommit[],
  prs: GitHubPR[],
): RawChange[] {
  const changes: RawChange[] = [];

  for (const commit of commits) {
    const message = commit.commit.message;
    const firstLine = message.split('\n')[0];
    const match = firstLine.match(CONVENTIONAL_COMMIT_REGEX);
    const prefix = match ? match[1] : undefined;
    const isBreaking = !!firstLine.match(/!:/);

    // Strip conventional prefix for cleaner title
    let cleanTitle = firstLine;
    if (match) {
      cleanTitle = firstLine.replace(CONVENTIONAL_COMMIT_REGEX, '').trim();
    }

    changes.push({
      type: 'commit',
      sha: commit.sha,
      title: cleanTitle || firstLine,
      body: message.includes('\n') ? message.slice(message.indexOf('\n') + 1).trim() : undefined,
      author: commit.author?.login || commit.commit.author.name,
      date: commit.commit.author.date,
      conventionalPrefix: isBreaking ? 'breaking' : prefix,
      category: 'Uncategorized',
    });
  }

  // Deduplicate: skip PRs whose merge commit SHA already appears
  const commitShas = new Set(commits.map((c) => c.sha));

  for (const pr of prs) {
    // We can't easily correlate PR merge commits here, so include all merged PRs
    // that don't obviously duplicate a commit title
    const isDuplicate = commits.some(
      (c) =>
        c.commit.message.split('\n')[0].toLowerCase().includes(pr.title.toLowerCase()) ||
        pr.title.toLowerCase().includes(c.commit.message.split('\n')[0].toLowerCase()),
    );

    if (isDuplicate) continue;

    const match = pr.title.match(CONVENTIONAL_COMMIT_REGEX);
    const prefix = match ? match[1] : undefined;
    const isBreaking = !!pr.title.match(/!:/);

    let cleanTitle = pr.title;
    if (match) {
      cleanTitle = pr.title.replace(CONVENTIONAL_COMMIT_REGEX, '').trim();
    }

    changes.push({
      type: 'pr',
      prNumber: pr.number,
      title: cleanTitle || pr.title,
      body: pr.body || undefined,
      author: pr.user?.login || 'unknown',
      date: pr.merged_at || '',
      labels: pr.labels?.map((l) => l.name) || [],
      conventionalPrefix: isBreaking ? 'breaking' : prefix,
      category: 'Uncategorized',
    });
  }

  // Remove orphaned sha set reference
  void commitShas;

  return changes;
}
