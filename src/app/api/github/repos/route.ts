import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { listRepos, searchRepos, createRepo, deleteRepo } from '@/lib/github';

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');
    const page = Number(req.nextUrl.searchParams.get('page') ?? '1');
    const q = req.nextUrl.searchParams.get('q');

    if (!accountId) {
      return Response.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    const token = account.token;

    if (q) {
      const result = await searchRepos(token, q + ' user:' + account.username, page);
      return Response.json({ items: result.items, totalCount: result.total_count });
    }

    const repos = await listRepos(token, '*', page);
    return Response.json({ items: repos, totalCount: repos.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch repos';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');

    if (!accountId) {
      return Response.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 });

    // If owner + repo are in query, treat as DELETE
    if (owner && repo) {
      await deleteRepo(account.token, owner, repo);
      return Response.json({ success: true });
    }

    // Otherwise create a new repo
    const body = await req.json();
    const { name, description, private: isPrivate } = body as {
      name?: string;
      description?: string;
      private?: boolean;
    };

    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await createRepo(account.token, {
      name,
      description,
      private: isPrivate,
    });

    return Response.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create/delete repo';
    return Response.json({ error: message }, { status: 500 });
  }
}
