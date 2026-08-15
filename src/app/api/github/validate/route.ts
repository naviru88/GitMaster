import { NextRequest, NextResponse } from 'next/server';
import { validateRepo } from '@/lib/github';
import { parseGitHubUrl } from '@/lib/parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { githubUrl, accessToken } = body as {
      githubUrl: string;
      accessToken?: string;
    };

    if (!githubUrl) {
      return NextResponse.json({ error: 'githubUrl is required' }, { status: 400 });
    }

    const { owner, repo } = parseGitHubUrl(githubUrl);
    const repoInfo = await validateRepo(owner, repo, accessToken);

    return NextResponse.json({
      name: repoInfo.name,
      fullName: repoInfo.full_name,
      description: repoInfo.description,
      htmlUrl: repoInfo.html_url,
      stars: repoInfo.stargazers_count,
      owner: repoInfo.owner,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    if (message.includes('401')) {
      return NextResponse.json({ error: 'Authentication failed. Check your access token.' }, { status: 401 });
    }
    if (message.includes('404')) {
      return NextResponse.json({ error: 'Repository not found. Check the URL.' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
