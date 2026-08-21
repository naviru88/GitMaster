import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchCommitsBetween, fetchMergedPRs } from '@/lib/github';
import { normalizeChanges } from '@/lib/parser';
import { classifyChanges } from '@/lib/classifier';
import { generateDraft } from '@/lib/draft';
import type { Voice } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, fromRef, toRef, voice, includePRs } = body as {
      projectId: string;
      fromRef: string;
      toRef: string;
      voice: Voice;
      includePRs?: boolean;
    };

    if (!projectId || !fromRef || !toRef || !voice) {
      return NextResponse.json(
        { error: 'projectId, fromRef, toRef, and voice are required' },
        { status: 400 },
      );
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const token = project.accessToken || undefined;

    // Fetch commits
    const commits = await fetchCommitsBetween(
      project.owner,
      project.repo,
      fromRef,
      toRef,
      token,
    );

    // Optionally fetch PRs
    let prs: Awaited<ReturnType<typeof fetchMergedPRs>> = [];
    if (includePRs && commits.length > 0) {
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

    // Parse and classify
    const rawChanges = normalizeChanges(commits, prs);
    const categorizedChanges = classifyChanges(rawChanges);

    // Generate draft via LLM
    const draftMarkdown = await generateDraft(
      categorizedChanges,
      {
        name: project.name,
        owner: project.owner,
        repo: project.repo,
        description: project.description,
      },
      voice,
    );

    // Save to DB
    const changelog = await db.changelog.create({
      data: {
        projectId,
        fromRef,
        toRef,
        voice,
        status: 'draft',
        rawChanges: JSON.stringify(categorizedChanges),
        draftMarkdown,
      },
    });

    return NextResponse.json(changelog, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate changelog';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
