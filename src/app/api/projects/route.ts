import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRepo } from '@/lib/github';
import { parseGitHubUrl } from '@/lib/parser';

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { changelogs: true } } },
    });
    return NextResponse.json(projects);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const project = await db.project.create({
      data: {
        name: repoInfo.name,
        owner,
        repo,
        githubUrl: repoInfo.html_url,
        description: repoInfo.description,
        accessToken: accessToken || null,
        stars: repoInfo.stargazers_count,
      },
      include: { _count: { select: { changelogs: true } } },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project';
    const status = message.includes('401') || message.includes('403') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
