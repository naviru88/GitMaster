import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commitId: string }> },
) {
  const { id: releaseId, commitId } = await params;

  const existing = await prisma.releaseCommit.findUnique({
    where: { id: commitId },
    select: { id: true, releaseId: true, sha: true },
  });

  if (!existing || existing.releaseId !== releaseId) {
    return NextResponse.json(
      { error: "Commit not found on this release" },
      { status: 404 },
    );
  }

  await prisma.releaseCommit.delete({ where: { id: commitId } });

  return NextResponse.json({
    deleted: true,
    sha: existing.sha,
  });
}
