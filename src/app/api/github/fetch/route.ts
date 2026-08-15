import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchCommitsBetween, fetchMergedPRs } from '@/lib/github';
import { normalizeChanges } from '@/lib/parser';
import { classifyChanges } from '@/lib/classifier';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, fromRef, toRef, includePRs } = body as {
      projectId: string;
      fromRef: string;
      toRef: string;
      includePRs?: boolean;
    };

    if (!projectId || !fromRef || !toRef) {
      return NextResponse.json(
        { error: 'projectId, fromRef, and toRef are required' },
        { status: 400 },
      );
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const token = project.accessToken || undefined;

    // Fetch commits between the two refs
    const commits = await fetchCommitsBetween(
      project.owner,
      project.repo,
      fromRef,
      toRef,
      token,
    );

    // Optionally fetch merged PRs
    let prs: Awaited<ReturnType<typeof fetchMergedPRs>> = [];
    if (includePRs) {
      // Use the date range from the first and last commit
      if (commits.length > 0) {
        const dates = commits.map((c) => new Date(c.commit.author.date).toISOString());
        const fromDate = dates[dates.length - 1];
        const toDate = dates[0];
        prs = await fetchMergedPRs(
          project.owner,
          project.repo,
          fromDate,
          toDate,
          token,
        );
      }
    }

    // Parse and classify
    const rawChanges = normalizeChanges(commits, prs);
    const categorizedChanges = classifyChanges(rawChanges);

    return NextResponse.json(categorizedChanges);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch changes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
