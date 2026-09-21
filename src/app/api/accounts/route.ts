import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGitHubUser } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { githubError } from '@/lib/errors';
import { encrypt } from '@/lib/crypto';

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
    const body = await req.json();
    const { label, token } = body as { label?: string; token?: string };

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

    // Encrypt the PAT before persisting it
    const encryptedToken = encrypt(token.trim());

    const account = await db.account.create({
      data: {
        label: label.trim(),
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url || null,
        token: encryptedToken,
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
