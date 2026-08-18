import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getGitHubUser } from '@/lib/github';

function stripToken(account: { token: string; [key: string]: unknown }) {
  const { token, ...rest } = account;
  return rest;
}

export async function GET() {
  try {
    const accounts = await db.account.findMany({ orderBy: { createdAt: 'desc' } });
    return Response.json(accounts.map(stripToken));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch accounts';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { label, token } = body as { label?: string; token?: string };

    if (!label || !token) {
      return Response.json({ error: 'label and token are required' }, { status: 400 });
    }

    const user = await getGitHubUser(token);

    const account = await db.account.create({
      data: {
        label,
        username: user.login,
        avatarUrl: user.avatar_url,
        token,
      },
    });

    return Response.json(stripToken(account), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create account';
    return Response.json({ error: message }, { status: 500 });
  }
}
