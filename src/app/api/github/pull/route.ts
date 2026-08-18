import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getArchiveUrl } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const ref = req.nextUrl.searchParams.get('ref') || 'main';
    const format = (req.nextUrl.searchParams.get('format') || 'zip') as 'zipball' | 'tarball';

    if (!accountId || !owner || !repo) {
      return NextResponse.json({ error: 'accountId, owner, and repo are required.' }, { status: 400 });
    }

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // Build the archive URL and proxy the download
    const archiveUrl = getArchiveUrl(owner, repo, ref, format);
    const ghRes = await fetch(archiveUrl, {
      headers: {
        Authorization: `Bearer ${account.token}`,
        Accept: 'application/octet-stream',
      },
      redirect: 'follow',
    });

    if (!ghRes.ok) {
      const text = await ghRes.text();
      return NextResponse.json({ error: `GitHub API ${ghRes.status}: ${text.slice(0, 200)}` }, { status: ghRes.status });
    }

    const filename = `${repo}-${ref}.${format === 'zipball' ? 'zip' : 'tar.gz'}`;
    const data = await ghRes.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to download archive';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
