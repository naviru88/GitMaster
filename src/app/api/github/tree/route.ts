import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRepoTree } from '@/lib/github';
import { githubError } from '@/lib/errors';
import { requireAuth, AuthError } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const branch = req.nextUrl.searchParams.get('branch') ?? undefined;

    if (!accountId || !owner || !repo) {
      return NextResponse.json(
        { error: 'accountId, owner, and repo are required' },
        { status: 400 },
      );
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const token = account.token ? decrypt(account.token) : undefined;
    const result = await getRepoTree(token, owner, repo, branch);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
