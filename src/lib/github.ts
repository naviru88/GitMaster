import type { GitHubRepo, GitHubTag, GitHubCommit, GitHubPR } from '@/types';

function buildHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubFetch<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function validateRepo(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubRepo> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  return githubFetch<GitHubRepo>(url, token);
}

export async function fetchTags(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubTag[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`;
  return githubFetch<GitHubTag[]>(url, token);
}

export async function fetchCommitsBetween(
  owner: string,
  repo: string,
  base: string,
  head: string,
  token?: string,
): Promise<GitHubCommit[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`;
  const res = await githubFetch<{
    commits: {
      sha: string;
      commit: {
        message: string;
        author: {
          name: string;
          email: string;
          date: string;
        };
      };
      author: {
        login: string;
      } | null;
      html_url: string;
    }[];
    status: string;
  }>(url, token);

  if (res.status === 'identical') {
    return [];
  }

  return res.commits.map((c) => ({
    sha: c.sha,
    commit: c.commit,
    author: c.author,
    html_url: c.html_url,
  }));
}

export async function fetchMergedPRs(
  owner: string,
  repo: string,
  fromDate: string,
  toDate: string,
  token?: string,
): Promise<GitHubPR[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`;
  const prs = await githubFetch<GitHubPR[]>(url, token);

  return prs.filter((pr) => {
    if (!pr.merged_at) return false;
    const merged = new Date(pr.merged_at).getTime();
    const from = new Date(fromDate).getTime();
    const to = new Date(toDate).getTime();
    return merged >= from && merged <= to;
  });
}
