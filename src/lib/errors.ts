/* ============================================================
   Shared Error Helpers
   ============================================================ */

export function githubError(err: unknown): { message: string; status: number } {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg === 'RATE_LIMITED') {
    return {
      message: 'GitHub API rate limit exceeded for unauthenticated requests. Please add a Personal Access Token to increase the limit.',
      status: 429,
    };
  }

  if (msg === 'RATE_LIMITED_AUTH') {
    return {
      message: 'GitHub is rate-limiting these requests and retrying didn\'t resolve it in time. This is usually GitHub\'s secondary (abuse-prevention) limit rather than your hourly quota — wait a minute or two, then try the push again. If it keeps happening on the same repo, try pushing fewer files at once.',
      status: 429,
    };
  }

  if (msg.startsWith('GitHub API 401') || msg.startsWith('GitHub API 403')) {
    return { message: msg, status: msg.includes('401') ? 401 : 403 };
  }

  if (msg.startsWith('GitHub API 404')) {
    return { message: msg, status: 404 };
  }

  return { message: msg, status: 500 };
}
