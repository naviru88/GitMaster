import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mergeBranches } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';

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
    const { owner, repo, base, head, message } = body as {
      owner?: string;
      repo?: string;
      base?: string;
      head?: string;
      message?: string;
    };

    if (!owner || !repo || !base || !head) {
      return NextResponse.json({ error: 'owner, repo, base, and head are required' }, { status: 400 });
    }

    const result = await mergeBranches(account.token, owner, repo, base, head, message);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to merge branches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
