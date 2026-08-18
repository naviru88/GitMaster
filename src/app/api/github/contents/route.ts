import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getContents, getFile, createOrUpdateFile, deleteFile } from '@/lib/github';
import { githubError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const path = req.nextUrl.searchParams.get('path') ?? '';
    const ref = req.nextUrl.searchParams.get('ref') ?? undefined;
    const single = req.nextUrl.searchParams.get('single') === 'true';

    if (!accountId || !owner || !repo) {
      return Response.json({ error: 'accountId, owner, and repo are required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    const token = account.token ?? undefined;

    const result = single
      ? await getFile(token, owner, repo, path, ref)
      : await getContents(token, owner, repo, path, ref);

    return Response.json(result);
  } catch (err: unknown) {
    const { message, status } = githubError(err);
    return Response.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');
    const action = req.nextUrl.searchParams.get('action');

    if (!accountId) {
      return Response.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    if (!account.token) {
      return Response.json({ error: 'A Personal Access Token is required for write operations.' }, { status: 403 });
    }

    const body = await req.json();

    if (action === 'delete') {
      const { owner, repo, path, message, sha, branch } = body as {
        owner: string;
        repo: string;
        path: string;
        message: string;
        sha: string;
        branch?: string;
      };

      if (!owner || !repo || !path || !message || !sha) {
        return Response.json({ error: 'owner, repo, path, message, and sha are required' }, { status: 400 });
      }

      await deleteFile(account.token, owner, repo, path, message, sha, branch);
      return Response.json({ success: true });
    }

    // action === 'save' or default
    const { owner, repo, path, content, message, sha, branch, isBase64 } = body as {
      owner: string;
      repo: string;
      path: string;
      content: string;
      message: string;
      sha?: string;
      branch?: string;
      isBase64?: boolean;
    };

    if (!owner || !repo || !path || content === undefined || !message) {
      return Response.json({ error: 'owner, repo, path, content, and message are required' }, { status: 400 });
    }

    const result = await createOrUpdateFile(account.token, owner, repo, path, content, message, sha, branch, isBase64);
    return Response.json(result);
  } catch (err: unknown) {
    const { message, status } = githubError(err);
    return Response.json({ error: message }, { status });
  }
}
