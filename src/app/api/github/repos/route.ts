import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listRepos, searchAccessibleRepos, createRepo, deleteRepo, updateRepoVisibility, updateRepoDescription, updateRepoName } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { githubError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const page = Number(req.nextUrl.searchParams.get('page') ?? '1');
    const q = req.nextUrl.searchParams.get('q');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const token = decrypt(account.token);

    if (q) {
      const result = await searchAccessibleRepos(token, q, page);
      return NextResponse.json({ items: result.items, totalCount: result.totalCount });
    }

    const repos = await listRepos(token, '*', page);
    return NextResponse.json({ items: repos, totalCount: repos.length });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message || 'Could not load repositories.' }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');

    if (!accountId || !owner || !repo) {
      return NextResponse.json(
        { error: 'accountId, owner, and repo are required' },
        { status: 400 },
      );
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    await deleteRepo(decrypt(account.token), owner, repo);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message || 'Could not delete the repository.' }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');

    if (!accountId || !owner || !repo) {
      return NextResponse.json(
        { error: 'accountId, owner, and repo are required' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    if (
      typeof body.private !== 'boolean'
      && typeof body.description !== 'string'
      && typeof body.name !== 'string'
    ) {
      return NextResponse.json(
        { error: 'private must be a boolean, description must be a string, or name must be a string' },
        { status: 400 },
      );
    }

    if (typeof body.name === 'string' && !body.name.trim()) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const token = decrypt(account.token);
    const updatedRepo = typeof body.private === 'boolean'
      ? await updateRepoVisibility(token, owner, repo, body.private)
      : typeof body.description === 'string'
        ? await updateRepoDescription(token, owner, repo, body.description.trim())
        : await updateRepoName(token, owner, repo, body.name.trim());
    return NextResponse.json(updatedRepo);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message || 'Could not update the repository.' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // Otherwise create a new repo
    const body = await req.json();
    const { name, description, private: isPrivate } = body as {
      name?: string;
      description?: string;
      private?: boolean;
    };

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await createRepo(decrypt(account.token), {
      name,
      description,
      private: isPrivate,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message || 'Could not create the repository.' }, { status });
  }
}
