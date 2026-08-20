import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listCommits } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const sha = req.nextUrl.searchParams.get('sha') ?? undefined;
    const page = Number(req.nextUrl.searchParams.get('page') ?? '1');

    if (!accountId || !owner || !repo) {
      return NextResponse.json({ error: 'accountId, owner, and repo are required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const commits = await listCommits(account.token, owner, repo, sha, page);
    return NextResponse.json(commits);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch commits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
