import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { batchCommit } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { githubError } from '@/lib/errors';

export const maxDuration = 60; // Allow up to 60s for large batch pushes

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!account.token) return NextResponse.json({ error: 'A Personal Access Token is required for push operations.' }, { status: 403 });

    const body = await req.json();
    const { owner, repo, branch, files, message, basePath } = body as {
      owner?: string; repo?: string; branch?: string;
      files?: Array<{ path: string; content: string; isBase64: boolean }>;
      message?: string; basePath?: string;
    };

    if (!owner || !repo || !branch || !files?.length || !message) {
      return NextResponse.json(
        { error: 'owner, repo, branch, files, and message are required.' },
        { status: 400 },
      );
    }

    if (files.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 files per batch push.' },
        { status: 400 },
      );
    }

    const result = await batchCommit(account.token, owner, repo, branch, files, message, basePath);
    return NextResponse.json({
      success: true,
      sha: result.sha,
      filesCommitted: result.fileCount,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
