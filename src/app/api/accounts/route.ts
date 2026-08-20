import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGitHubUser } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';

function stripToken(account: { token: string; [key: string]: unknown }) {
  const { token, ...rest } = account;
  return rest;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accounts = await db.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(accounts.map(stripToken));
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch accounts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { label, token } = body as { label?: string; token?: string };

    if (!label || !token) {
      return NextResponse.json({ error: 'label and token are required' }, { status: 400 });
    }

    const ghUser = await getGitHubUser(token);

    const account = await db.account.create({
      data: {
        label,
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        token,
        userId: user.id,
      },
    });

    return NextResponse.json(stripToken(account), { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to create account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
