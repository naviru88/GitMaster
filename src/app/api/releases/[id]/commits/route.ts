import { NextRequest, NextResponse } from "next/server";
import { Prisma, ChangeType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const CHANGE_TYPES = [
  "ADDED",
  "CHANGED",
  "FIXED",
  "REMOVED",
  "DEPRECATED",
  "SECURITY",
] as const;

// GET
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: releaseId } = await params;

  const commits = await prisma.releaseCommit.findMany({
    where: { releaseId },
    orderBy: [{ order: "asc" }, { committedAt: "asc" }],
  });

  return NextResponse.json({ commits, count: commits.length });
}


// POST
interface AttachCommitBody {
  sha?: unknown;
  message?: unknown;
  authorName?: unknown;
  authorEmail?: unknown;
  committedAt?: unknown;
  changeType?: unknown;
  note?: unknown;
  order?: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: releaseId } = await params;

  let body: AttachCommitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Validate
  if (typeof body.sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(body.sha)) {
    return NextResponse.json(
      { error: "`sha` must be a 7–40 character hex string" },
      { status: 400 },
    );
  }
  if (typeof body.message !== "string" || body.message.length === 0) {
    return NextResponse.json(
      { error: "`message` is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  if (body.changeType !== undefined && body.changeType !== null) {
    if (
      typeof body.changeType !== "string" ||
      !CHANGE_TYPES.includes(body.changeType as (typeof CHANGE_TYPES)[number])
    ) {
      return NextResponse.json(
        { error: `changeType must be one of: ${CHANGE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
  }

  // Verify release exists
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true },
  });
  if (!release) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404 },
    );
  }

  // Figure out order if not provided (append to end)
  let order: number;
  if (typeof body.order === "number" && Number.isInteger(body.order)) {
    order = body.order;
  } else {
    const last = await prisma.releaseCommit.findFirst({
      where: { releaseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (last?.order ?? -1) + 1;
  }

  // committedAt
  let committedAt: Date | undefined;
  if (body.committedAt !== undefined && body.committedAt !== null) {
    if (typeof body.committedAt !== "string") {
      return NextResponse.json(
        { error: "`committedAt` must be an ISO date string or null" },
        { status: 400 },
      );
    }
    const d = new Date(body.committedAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "`committedAt` is not a valid date" },
        { status: 400 },
      );
    }
    committedAt = d;
  }

  // Create
  try {
    const created = await prisma.releaseCommit.create({
      data: {
        releaseId,
        sha: body.sha.toLowerCase(),
        message: body.message,
        authorName:
          typeof body.authorName === "string" ? body.authorName : null,
        authorEmail:
          typeof body.authorEmail === "string" ? body.authorEmail : null,
        committedAt: committedAt ?? null,
        changeType: (body.changeType as ChangeType | undefined) ?? null,
        note: typeof body.note === "string" ? body.note : null,
        order,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "This commit is already attached to this release" },
          { status: 409 },
        );
      }
    }
    console.error("Failed to attach commit:", e);
    return NextResponse.json(
      { error: "Failed to attach commit" },
      { status: 500 },
    );
  }
}
