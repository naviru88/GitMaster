import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moveEntry } from '@/lib/github';
import { githubError } from '@/lib/errors';
import { requireAuth, AuthError } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!account.token) {
      return NextResponse.json(
        { error: 'A Personal Access Token is required for write operations.' },
        { status: 403 },
      );
    }

    const token = decrypt(account.token);
    const body = await req.json();

    const { owner, repo, branch, fromPath, toPath, isDirectory, message } = body as {
      owner: string;
      repo: string;
      branch: string;
      fromPath: string;
      toPath: string;
      isDirectory?: boolean;
      message?: string;
    };

    if (!owner || !repo || !branch || !fromPath || !toPath) {
      return NextResponse.json(
        { error: 'owner, repo, branch, fromPath, and toPath are required' },
        { status: 400 },
      );
    }

    if (fromPath === toPath) {
      return NextResponse.json({ error: 'Source and destination are identical' }, { status: 400 });
    }

    if (toPath.startsWith(fromPath + '/')) {
      return NextResponse.json(
        { error: 'Cannot move a folder into itself' },
        { status: 400 },
      );
    }

    const result = await moveEntry(token, {
      owner,
      repo,
      branch,
      fromPath,
      toPath,
      isDirectory: Boolean(isDirectory),
      message,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
