import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkMergeConflicts, resolveMergeConflicts } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { githubError } from '@/lib/errors';

// Fetching three file versions (ancestor/base/head) per conflicting path can
// mean a real number of Contents API round-trips for a large diverging
// history — give this more headroom than the default route timeout.
export const maxDuration = 60;

/** GET — detect what actually conflicts between two branches, without
 * changing anything. Called right after GitHub's /merges endpoint 409s. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const base = req.nextUrl.searchParams.get('base');
    const head = req.nextUrl.searchParams.get('head');

    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (!owner || !repo || !base || !head) {
      return NextResponse.json({ error: 'owner, repo, base, and head are required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const result = await checkMergeConflicts(account.token, owner, repo, base, head);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** POST — commit the resolved merge: auto-applied head-only files plus the
 * user's resolutions for each real conflict, as a genuine two-parent merge
 * commit on `base`. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!account.token) return NextResponse.json({ error: 'A Personal Access Token is required to create a merge commit.' }, { status: 403 });

    const body = await req.json();
    const { owner, repo, base, head, message, autoApplyPaths, resolutions } = body as {
      owner?: string; repo?: string; base?: string; head?: string; message?: string;
      autoApplyPaths?: string[];
      resolutions?: Array<{ path: string; content: string | null }>;
    };

    if (!owner || !repo || !base || !head) {
      return NextResponse.json({ error: 'owner, repo, base, and head are required' }, { status: 400 });
    }
    if (!Array.isArray(autoApplyPaths) || !Array.isArray(resolutions)) {
      return NextResponse.json({ error: 'autoApplyPaths and resolutions are required' }, { status: 400 });
    }
    for (const r of resolutions) {
      if (!r || typeof r.path !== 'string' || (typeof r.content !== 'string' && r.content !== null)) {
        return NextResponse.json({ error: 'Each resolution needs a path and a content string (or null to delete the file)' }, { status: 400 });
      }
    }

    // Re-detect conflicts server-side rather than trusting the client's
    // list of what needs resolving — the branches could have moved since
    // the GET call, and this is also what catches an incomplete
    // submission (e.g. a text conflict the user never actually resolved,
    // or a binary/too-large one that can't be resolved in-app at all).
    const check = await checkMergeConflicts(account.token, owner, repo, base, head);
    const resolvedPaths = new Set(resolutions.map((r) => r.path));
    const unresolved = check.conflicts.filter((c) => !resolvedPaths.has(c.path));
    if (unresolved.length > 0) {
      return NextResponse.json(
        {
          error: `${unresolved.length} conflict(s) still need to be resolved before this merge can be committed.`,
          unresolvedPaths: unresolved.map((c) => c.path),
          // Surfaced so the UI can tell the user exactly which files can't
          // be resolved in-app at all (binary/too large) vs. which just
          // haven't been filled in yet.
          blockedByBinaryOrSize: unresolved.filter((c) => c.isBinary || c.tooLarge).map((c) => c.path),
        },
        { status: 409 },
      );
    }

    const result = await resolveMergeConflicts(
      account.token,
      owner,
      repo,
      base,
      head,
      message || `Merge ${head} into ${base}`,
      check.autoApplyPaths,
      // Only pass through resolutions for paths GitHub-side detection
      // actually confirmed are conflicts — ignore anything else the client
      // sent, so a resolution can't be used to smuggle in an arbitrary
      // unrelated file write.
      resolutions.filter((r) => check.conflicts.some((c) => c.path === r.path)),
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
