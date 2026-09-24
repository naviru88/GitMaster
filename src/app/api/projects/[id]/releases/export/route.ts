// Return full release history as a self-contained HTML document.

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildReleaseTree } from "@/lib/releases/tree";
import { generateReleaseHtml } from "@/lib/releases/html-generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const url = new URL(req.url);

  const format = url.searchParams.get("format") ?? "html";
  const disposition = url.searchParams.get("disposition") ?? "attachment";
  const theme = (url.searchParams.get("theme") ?? "auto") as
    | "light"
    | "dark"
    | "auto";
  const indent = (url.searchParams.get("indent") ?? "2-spaces") as
    | "2-spaces"
    | "4-spaces";
  const includeUnpublished =
    url.searchParams.get("published") === "all";

  if (format !== "html") {
    return NextResponse.json(
      { error: `Unsupported format: ${format}. Only "html" is implemented.` },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      owner: true,
      repo: true,
      description: true,
    },
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

  const html = generateReleaseHtml({
    repoName: project.name,
    subtitle: `All releases for ${project.owner}/${project.repo}`,
    tree,
    theme,
    indent,
  });

  const filename = `${project.owner}-${project.repo}-releases.html`
    .replace(/[^a-z0-9.-]+/gi, "-")
    .toLowerCase();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
