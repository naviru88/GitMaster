import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const changelog = await db.changelog.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!changelog) {
      return NextResponse.json({ error: 'Changelog not found' }, { status: 404 });
    }

    return NextResponse.json(changelog);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch changelog';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { draftMarkdown, status, version } = body as {
      draftMarkdown?: string;
      status?: string;
      version?: string;
    };

    const existing = await db.changelog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Changelog not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (draftMarkdown !== undefined) {
      updateData.draftMarkdown = draftMarkdown;
    }

    if (status !== undefined) {
      if (status !== 'draft' && status !== 'published') {
        return NextResponse.json(
          { error: 'status must be "draft" or "published"' },
          { status: 400 },
        );
      }
      updateData.status = status;

      // If publishing, copy draft to final
      if (status === 'published') {
        updateData.finalMarkdown = draftMarkdown || existing.draftMarkdown;
      }
    }

    if (version !== undefined) {
      updateData.version = version;
    }

    const changelog = await db.changelog.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(changelog);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update changelog';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
