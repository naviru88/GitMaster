import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listBranches, createBranch } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';

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

    const branches = await listBranches(account.token, owner, repo);
    return NextResponse.json(branches);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch branches';
    return NextResponse.json({ error: message }, { status: 500 });
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

    await createBranch(account.token, owner, repo, branch, fromSha);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to create branch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
