import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";

interface Body {
  owner?: unknown;
  repo?: unknown;
  githubUrl?: unknown;
  name?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.owner !== "string" || body.owner.length === 0) {
      return NextResponse.json({ error: "`owner` is required" }, { status: 400 });
    }
    if (typeof body.repo !== "string" || body.repo.length === 0) {
      return NextResponse.json({ error: "`repo` is required" }, { status: 400 });
    }
    if (typeof body.githubUrl !== "string" || body.githubUrl.length === 0) {
      return NextResponse.json({ error: "`githubUrl` is required" }, { status: 400 });
    }

    const owner = body.owner;
    const repo = body.repo;
    const githubUrl = body.githubUrl;
    const name = typeof body.name === "string" ? body.name : repo;

    const existing = await db.project.findFirst({
      where: { owner, repo },
      select: { id: true, name: true, owner: true, repo: true },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const created = await db.project.create({
      data: { name, owner, repo, githubUrl },
      select: { id: true, name: true, owner: true, repo: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/releases/project failed:", err);
    return NextResponse.json({ error: "Failed to resolve project" }, { status: 500 });
  }
}
