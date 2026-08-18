import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { listCommits } from '@/lib/github';

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const sha = req.nextUrl.searchParams.get('sha') ?? undefined;
    const page = Number(req.nextUrl.searchParams.get('page') ?? '1');

    if (!accountId || !owner || !repo) {
      return Response.json({ error: 'accountId, owner, and repo are required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    const commits = await listCommits(account.token, owner, repo, sha, page);
    return Response.json(commits);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch commits';
    return Response.json({ error: message }, { status: 500 });
  }
}
