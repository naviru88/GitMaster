import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listBranches, createBranch, deleteBranch, renameBranch } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { githubError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');

    if (!accountId || !owner || !repo) {
      return NextResponse.json({ error: 'accountId, owner, and repo are required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const branches = await listBranches(decrypt(account.token), owner, repo);
    return NextResponse.json(branches);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const body = await req.json();
    const { owner, repo, branch, fromSha } = body as {
      owner?: string;
      repo?: string;
      branch?: string;
      fromSha?: string;
    };

    if (!owner || !repo || !branch || !fromSha) {
      return NextResponse.json({ error: 'owner, repo, branch, and fromSha are required' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9._\-/]+$/.test(branch)) {
      return NextResponse.json({ error: 'Branch name contains invalid characters.' }, { status: 400 });
    }

    await createBranch(decrypt(account.token), owner, repo, branch, fromSha);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** DELETE — permanently removes a branch from the remote.
 *  Protected branches and the default branch are rejected by GitHub. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!accountId || !owner || !repo || !branch) {
      return NextResponse.json({ error: 'accountId, owner, repo, and branch are required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    await deleteBranch(decrypt(account.token), owner, repo, branch);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** PATCH — rename a branch (create new ref from old SHA, delete old ref). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const body = await req.json();
    const { owner, repo, oldName, newName } = body as {
      owner?: string;
      repo?: string;
      oldName?: string;
      newName?: string;
    };

    if (!owner || !repo || !oldName || !newName) {
      return NextResponse.json({ error: 'owner, repo, oldName, and newName are required' }, { status: 400 });
    }

    if (!newName.trim()) {
      return NextResponse.json({ error: 'New branch name cannot be empty.' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9._\-/]+$/.test(newName.trim())) {
      return NextResponse.json({ error: 'New branch name contains invalid characters.' }, { status: 400 });
    }

    await renameBranch(decrypt(account.token), owner, repo, oldName, newName.trim());
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
