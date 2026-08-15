import { NextRequest, NextResponse } from 'next/server';
import { fetchTags } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const accessToken = searchParams.get('accessToken') || undefined;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'owner and repo query params are required' },
        { status: 400 },
      );
    }

    const allTags = await fetchTags(owner, repo, accessToken);
    // Filter to only version tags (v1.0.0, v2.1.3, etc.)
    const versionTags = allTags.filter((t) => /^v\d/.test(t.name));
    return NextResponse.json(versionTags.length > 0 ? versionTags : allTags.slice(0, 50));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tags';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
