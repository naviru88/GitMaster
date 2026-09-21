/* ============================================================
   Shared Error Helpers
   ============================================================ */

/**
 * Parse a raw error thrown by ghFetch() or a GitHub API route handler
 * and return a user-friendly message with an appropriate HTTP status.
 */
export function githubError(err: unknown): { message: string; status: number } {
  const msg = err instanceof Error ? err.message : String(err);

  // ---- Internal sentinel errors from ghFetch ----
  if (msg === 'RATE_LIMITED') {
    return {
      message:
        'You\'ve hit GitHub\'s rate limit for unauthenticated requests. ' +
        'Add a Personal Access Token to your account to get a much higher limit.',
      status: 429,
    };
  }

  if (msg === 'RATE_LIMITED_AUTH') {
    return {
      message:
        'GitHub is temporarily throttling requests from this token (secondary rate limit). ' +
        'This usually resolves itself — wait a minute or two and try again. ' +
        'If it keeps happening, try pushing fewer files at once.',
      status: 429,
    };
  }

  // ---- GitHub HTTP status codes ----

  if (msg.includes('GitHub API 400')) {
    return {
      message: 'GitHub rejected the request — please check that all field values are valid.',
      status: 400,
    };
  }

  if (msg.includes('GitHub API 401')) {
    return {
      message:
        'Your GitHub token is invalid or has expired. ' +
        'Please remove this account and add it again with a fresh Personal Access Token.',
      status: 401,
    };
  }

  if (msg.includes('GitHub API 403')) {
    // Check for branch protection specifically
    if (/protected branch|required status|push access/i.test(msg)) {
      return {
        message:
          'This branch is protected and your token doesn\'t have permission to push to it. ' +
          'Check the branch protection rules in your repository settings, or use a token with admin scope.',
        status: 403,
      };
    }
    return {
      message:
        'Permission denied. Your token doesn\'t have the required scope for this operation. ' +
        'Make sure your Personal Access Token has the "repo" scope enabled on GitHub.',
      status: 403,
    };
  }

  if (msg.includes('GitHub API 404')) {
    return {
      message:
        'The repository or resource could not be found. ' +
        'Check the repo name and make sure your account has access to it.',
      status: 404,
    };
  }

  if (msg.includes('GitHub API 409')) {
    return {
      message:
        'There are conflicting changes that can\'t be merged automatically. ' +
        'Use the conflict resolver to review and fix them.',
      status: 409,
    };
  }

  if (msg.includes('GitHub API 422')) {
    // Unprocessable entity — common causes: invalid branch name, duplicate repo name, etc.
    if (/already exists/i.test(msg)) {
      return {
        message: 'A resource with that name already exists. Please choose a different name.',
        status: 422,
      };
    }
    if (/reference already exists/i.test(msg)) {
      return {
        message: 'A branch with that name already exists. Please choose a different name.',
        status: 422,
      };
    }
    return {
      message:
        'GitHub rejected the request — the data provided was invalid. ' +
        'This can happen with special characters in branch or repo names.',
      status: 422,
    };
  }

  if (msg.includes('GitHub API 500') || msg.includes('GitHub API 502') || msg.includes('GitHub API 503')) {
    return {
      message:
        'GitHub is experiencing issues on their end. Please try again in a moment.',
      status: 502,
    };
  }

  // ---- Generic fallback ----
  return { message: msg, status: 500 };
}
