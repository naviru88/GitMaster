import { NextRequest, NextResponse } from "next/server";
import { Prisma, ReleaseLevel } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildReleaseTree } from "@/lib/releases/tree";
import { parseVersion, VersionError } from "@/lib/releases/version";

// GET — list releases
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const url = new URL(req.url);

  const publishedParam = url.searchParams.get("published");
  const includeUnpublished = publishedParam === "all";

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, owner: true, repo: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 },
    );
  }

  const rows = await prisma.release.findMany({
    where: {
      projectId,
      ...(includeUnpublished ? {} : { published: true }),
    },
    include: {
      commits: {
        orderBy: [{ order: "asc" }, { committedAt: "asc" }],
      },
    },
  });

  const tree = buildReleaseTree(rows);

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      fullName: `${project.owner}/${project.repo}`,
    },
    tree,
    count: rows.length,
  });
}

// POST — create a release
interface CreateReleaseBody {
  version?: unknown;
  title?: unknown;
  description?: unknown;
  releasedAt?: unknown;
  published?: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  let body: CreateReleaseBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof body.version !== "string") {
    return NextResponse.json(
      { error: "`version` is required and must be a string" },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = parseVersion(body.version);
  } catch (e) {
    if (e instanceof VersionError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 },
    );
  }

  const existing = await prisma.release.findUnique({
    where: {
      projectId_version: { projectId, version: parsed.version },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: `Release ${parsed.version} already exists for this project` },
      { status: 409 },
    );
  }

  let parentId: string | null = null;

  if (parsed.parentVersion !== null) {
    const parent = await prisma.release.findUnique({
      where: {
        projectId_version: {
          projectId,
          version: parsed.parentVersion,
        },
      },
      select: { id: true },
    });

    if (!parent) {
      return NextResponse.json(
        {
          error:
            `Parent version ${parsed.parentVersion} does not exist. ` +
            `Create it first.`,
        },
        { status: 400 },
      );
    }

    parentId = parent.id;
  }

  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== "string" || body.title.length > 200) {
      return NextResponse.json(
        { error: "`title` must be a string under 200 characters" },
        { status: 400 },
      );
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (
      typeof body.description !== "string" ||
      body.description.length > 20000
    ) {
      return NextResponse.json(
        { error: "`description` must be a string under 20000 characters" },
        { status: 400 },
      );
    }
  }

  let releasedAt: Date | undefined;
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
    releasedAt = d;
  }

  const published =
    typeof body.published === "boolean" ? body.published : false;

  try {
    const created = await prisma.release.create({
      data: {
        projectId,
        version: parsed.version,
        level: parsed.level as ReleaseLevel,
        title: (body.title as string | undefined) ?? null,
        description: (body.description as string | undefined) ?? null,
        releasedAt: releasedAt ?? new Date(),
        published,
        parentId,
      },
      include: { commits: true },
    });

    return NextResponse.json(
      {
        id: created.id,
        version: created.version,
        level: created.level,
        parentId: created.parentId,
        published: created.published,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: `Release ${parsed.version} already exists` },
          { status: 409 },
        );
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Parent release does not exist" },
          { status: 400 },
        );
      }
    }
    console.error("Failed to create release:", e);
    return NextResponse.json(
      { error: "Failed to create release" },
      { status: 500 },
    );
  }
}
