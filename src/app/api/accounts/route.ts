import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mergeBranches } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { githubError } from '@/lib/errors';

/** Never send the raw PAT back to the browser. */
function redact<T extends { token: string }>(account: T): T {
  return { ...account, token: '' };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountList = await db.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(accountList.map(redact));
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to load accounts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');

    if (!label?.trim() || !token?.trim()) {
      return NextResponse.json({ error: 'A label and a GitHub Personal Access Token are required.' }, { status: 400 });
    }

    // Validate the token against GitHub before storing it
    let ghUser;
    try {
      ghUser = await getGitHubUser(token.trim());
    } catch (err) {
      const { message, status } = githubError(err);
      return NextResponse.json(
        { error: status === 401 || status === 403 ? 'GitHub rejected that token — check it\'s valid and hasn\'t expired or been revoked.' : message },
        { status: status === 500 ? 400 : status },
      );
    }

    const account = await db.account.create({
      data: {
        label: label.trim(),
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url || null,
        token: token.trim(),
        provider: 'github',
        userId: user.id,
      },
    });

    return NextResponse.json(redact(account), { status: 201 });
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
    const message = err instanceof Error ? err.message : 'Failed to add account';
    return NextResponse.json({ error: message }, { status: 500 });
    const message = err instanceof Error ? err.message : 'Failed to merge branches';
    // Preserve GitHub's real status code
    const statusMatch = message.match(/^GitHub API (\d{3}):/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
