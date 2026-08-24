import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGitHubUser } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { githubError } from '@/lib/errors';

/** Never send the raw PAT back to the browser. Every route that talks to
 * GitHub looks the token up server-side by accountId — the client only
 * ever needs id/label/username/avatarUrl — so redact it here rather than
 * relying on every future caller to remember not to log/display it. */
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
    const body = await req.json();
    const { label, token } = body as { label?: string; token?: string };

    if (!label?.trim() || !token?.trim()) {
      return NextResponse.json({ error: 'A label and a GitHub Personal Access Token are required.' }, { status: 400 });
    }

    // Validate the token against GitHub before storing it, and use the
    // response to fill in username/avatar automatically instead of asking
    // for them — this also catches a bad/expired/revoked token immediately
    // with a clear message, rather than only surfacing it later on the
    // first repo action.
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
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to add account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
