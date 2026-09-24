import { NextRequest, NextResponse } from "next/server";
import { Prisma, ReleaseLevel } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseVersion, VersionError } from "@/lib/releases/version";

// GET
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const release = await prisma.release.findUnique({
    where: { id },
    include: {
      commits: {
        orderBy: [{ order: "asc" }, { committedAt: "asc" }],
      },
      children: {
        orderBy: { version: "asc" },
        include: { commits: true },
      },
    },
  });

  if (!release) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(release);
}

// PATCH
interface UpdateReleaseBody {
  version?: unknown;
  title?: unknown;
  description?: unknown;
  releasedAt?: unknown;
  published?: unknown;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: UpdateReleaseBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const existing = await prisma.release.findUnique({
    where: { id },
    select: { id: true, projectId: true, version: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404 },
    );
  }

  const data: Prisma.ReleaseUpdateInput = {};

  // version (rare — usually immutable after creation)
  if (body.version !== undefined) {
    if (typeof body.version !== "string") {
      return NextResponse.json(
        { error: "`version` must be a string" },
        { status: 400 },
      );
    }

    let parsed;
    try {
      parsed = parseVersion(body.version);
    } catch (e) {
      if (e instanceof VersionError) {
        return NextResponse.json(
          { error: e.message },
          { status: 400 },
        );
      }
      throw e;
    }

    // Check uniqueness within project
    const collision = await prisma.release.findFirst({
      where: {
        projectId: existing.projectId,
        version: parsed.version,
        NOT: { id },
      },
      select: { id: true },
    });

    if (collision) {
      return NextResponse.json(
        { error: `Version ${parsed.version} already exists` },
        { status: 409 },
      );
    }

    data.version = parsed.version;
    data.level = parsed.level as ReleaseLevel;

    // Resolve parent
    if (parsed.parentVersion === null) {
      data.parent = { disconnect: true };
    } else {
      const parent = await prisma.release.findUnique({
        where: {
          projectId_version: {
            projectId: existing.projectId,
            version: parsed.parentVersion,
          },
        },
        select: { id: true },
      });

      if (!parent) {
        return NextResponse.json(
          { error: `Parent ${parsed.parentVersion} does not exist` },
          { status: 400 },
        );
      }
      if (parent.id === id) {
        return NextResponse.json(
          { error: "A release cannot be its own parent" },
          { status: 400 },
        );
      }

      data.parent = { connect: { id: parent.id } };
    }
  }

  // title
  if (body.title !== undefined) {
    if (body.title === null) {
      data.title = null;
    } else if (
      typeof body.title === "string" &&
      body.title.length <= 200
    ) {
      data.title = body.title;
    } else {
      return NextResponse.json(
        { error: "`title` must be null or a string under 200 chars" },
        { status: 400 },
      );
    }
  }

  // description
  if (body.description !== undefined) {
    if (body.description === null) {
      data.description = null;
    } else if (
      typeof body.description === "string" &&
      body.description.length <= 20000
    ) {
      data.description = body.description;
    } else {
      return NextResponse.json(
        { error: "`description` must be null or a string under 20000 chars" },
        { status: 400 },
      );
    }
  }

  // releasedAt
  if (body.releasedAt !== undefined) {
    if (typeof body.releasedAt !== "string") {
      return NextResponse.json(
        { error: "`releasedAt` must be an ISO date string" },
        { status: 400 },
      );
    }
    const d = new Date(body.releasedAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "`releasedAt` is not a valid date" },
        { status: 400 },
      );
    }
    data.releasedAt = d;
  }

  // published
  if (body.published !== undefined) {
    if (typeof body.published !== "boolean") {
      return NextResponse.json(
        { error: "`published` must be a boolean" },
        { status: 400 },
      );
    }
    data.published = body.published;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields provided" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.release.update({
      where: { id },
      data,
      include: { commits: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "Version already exists" },
          { status: 409 },
        );
      }
    }
    console.error("Failed to update release:", e);
    return NextResponse.json(
      { error: "Failed to update release" },
      { status: 500 },
    );
  }
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.release.findUnique({
    where: { id },
    select: {
      id: true,
      version: true,
      _count: { select: { children: true, commits: true } },
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404 },
    );
  }

  // Cascade will delete children + commits (see schema onDelete: Cascade).
  await prisma.release.delete({ where: { id } });

  return NextResponse.json({
    deleted: true,
    version: existing.version,
    cascadedChildren: existing._count.children,
    cascadedCommits: existing._count.commits,
  });
}
