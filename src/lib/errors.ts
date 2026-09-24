//Shared Error Helpers
export function githubError(err: unknown): { message: string; status: number } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

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

  // GitHub HTTP status codes

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

  if (/\b(?:github api|http)\s*401\b/.test(lower) || /invalid.*token|bad credentials|token.*expired/.test(lower)) {
    return {
      message: 'Your GitHub token is invalid or has expired. Remove this account and add it again with a fresh token.',
      status: 401,
    };
  }

  if (/\b(?:github api|http)\s*403\b/.test(lower)) {
    return {
      message: 'GitHub denied this action. Confirm that this account has access to the repository and the token can write to it.',
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

  if (/\b(?:github api|http)\s*404\b/.test(lower)) {
    return {
      message: 'GitHub could not find that repository or branch. Check the name and confirm this account can access it.',
      status: 404,
    };
  }

  if (/\b(?:github api|http)\s*409\b/.test(lower)) {
    return {
      message: 'GitHub found a conflict. Refresh the repository and retry with the latest branch state.',
      status: 409,
    };
  }

  if (/\b(?:github api|http)\s*422\b/.test(lower)) {
    return {
      message: 'GitHub rejected the values in this request. Check the branch, file, or repository name and try again.',
      status: 422,
    };
  }

  if (/\b(?:github api|http)\s*(?:429|5\d{2})\b/.test(lower) || lower.includes('fetch failed')) {
    return {
      message: 'GitHub is temporarily unavailable. Please wait a moment and try again.',
      status: lower.includes('429') ? 429 : 502,
    };
  }

  if (msg.includes('GitHub API 500') || msg.includes('GitHub API 502') || msg.includes('GitHub API 503')) {
    return {
      message:
        'GitHub is experiencing issues on their end. Please try again in a moment.',
      status: 502,
    };
  }

  // Generic fallback
  if (lower.includes('encryption') || lower.includes('ciphertext') || lower.includes('token')) {
    return {
      message: 'The saved GitHub account could not be unlocked. Remove it and add it again, then retry the operation.',
      status: 500,
    };
  }

  return {
    message: msg && !/^https?:\/\//i.test(msg)
      ? msg
      : 'Something went wrong while completing the request. Please try again.',
    status: 500,
  };
}
