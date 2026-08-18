import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, deleteSessionCookie, AuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to get user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
