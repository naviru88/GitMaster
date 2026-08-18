import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { listBranches, createBranch } from '@/lib/github';

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');

    if (!accountId || !owner || !repo) {
      return Response.json({ error: 'accountId, owner, and repo are required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    const branches = await listBranches(account.token, owner, repo);
    return Response.json(branches);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch branches';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return Response.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    const body = await req.json();
    const { owner, repo, branch, fromSha } = body as {
      owner?: string;
      repo?: string;
      branch?: string;
      fromSha?: string;
    };

    if (!owner || !repo || !branch || !fromSha) {
      return Response.json({ error: 'owner, repo, branch, and fromSha are required' }, { status: 400 });
    }

    await createBranch(account.token, owner, repo, branch, fromSha);
    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create branch';
    return Response.json({ error: message }, { status: 500 });
  }
}
