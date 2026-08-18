import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { mergeBranches } from '@/lib/github';

export async function POST(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return Response.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    const body = await req.json();
    const { owner, repo, base, head, message } = body as {
      owner?: string;
      repo?: string;
      base?: string;
      head?: string;
      message?: string;
    };

    if (!owner || !repo || !base || !head) {
      return Response.json({ error: 'owner, repo, base, and head are required' }, { status: 400 });
    }

    const result = await mergeBranches(account.token, owner, repo, base, head, message);
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to merge branches';
    return Response.json({ error: message }, { status: 500 });
  }
}
