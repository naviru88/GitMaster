import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { batchCommit } from '@/lib/github';
import { requireAuth, AuthError } from '@/lib/auth';
import { githubError } from '@/lib/errors';

export const maxDuration = 60; // Allow up to 60s for large batch pushes

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (!account.token) return NextResponse.json({ error: 'A Personal Access Token is required for push operations.' }, { status: 403 });

    const body = await req.json();
    const { owner, repo, branch, files, message, basePath } = body as {
      owner?: string; repo?: string; branch?: string;
      files?: Array<{ path: string; content: string; isBase64: boolean }>;
      message?: string; basePath?: string;
    };

    if (!owner || !repo || !branch || !files?.length || !message) {
      return NextResponse.json(
        { error: 'owner, repo, branch, files, and message are required.' },
        { status: 400 },
      );
    }

    // Per-file sanity checks — catches corrupted/malformed entries before we
    // spend a GitHub API call on them, and reports exactly which file is bad
    // instead of a generic failure for the whole batch.
    const GITHUB_MAX_BLOB_BYTES = 100 * 1024 * 1024; // GitHub's own blob size ceiling
    const badFiles: Array<{ path: string; reason: string }> = [];
    for (const f of files) {
      if (!f || typeof f.path !== 'string' || !f.path.trim()) {
        badFiles.push({ path: f?.path || '(unknown)', reason: 'missing or invalid path' });
        continue;
      }
      if (f.path.includes('..') || f.path.startsWith('/')) {
        badFiles.push({ path: f.path, reason: 'unsafe path (contains ".." or is absolute)' });
        continue;
      }
      // GitHub's Git Trees API unconditionally rejects any path with a
      // `.git` component ("tree.path contains a malformed path component").
      // The client already filters these out, but this is a required
      // backstop — the client shouldn't be the only thing standing between
      // an accidental .git/ push and a confusing 422 from GitHub.
      if (f.path.split('/').some((seg) => seg.toLowerCase() === '.git')) {
        badFiles.push({ path: f.path, reason: 'GitHub rejects any path inside a .git/ directory' });
        continue;
      }
      if (typeof f.content !== 'string') {
        badFiles.push({ path: f.path, reason: 'missing content' });
        continue;
      }
      // Base64 is ~4/3 the size of raw bytes — use as a proxy without decoding.
      const approxBytes = f.isBase64 ? f.content.length * 0.75 : f.content.length;
      if (approxBytes > GITHUB_MAX_BLOB_BYTES) {
        badFiles.push({ path: f.path, reason: `exceeds GitHub's 100MB per-file limit (~${Math.round(approxBytes / 1024 / 1024)}MB)` });
      }
    }
    if (badFiles.length > 0) {
      return NextResponse.json(
        {
          error: `${badFiles.length} file(s) could not be pushed.`,
          invalidFiles: badFiles,
        },
        { status: 422 },
      );
    }

    // No hard cap on file *count* anymore — GitHub's Git Trees API doesn't
    // impose one either. What actually matters is total payload size, which
    // is guarded below.
    //
    // Guard against oversized payloads (e.g. a mistakenly un-.gitignore'd
    // node_modules) failing silently with a slow timeout — reject up front
    // with a clear message instead. Base64 content is ~4/3 the size of the
    // original bytes, so this is a reasonable proxy for total upload size.
    const MAX_TOTAL_BASE64_BYTES = 300 * 1024 * 1024; // ~300MB base64 (~220MB raw)
    const totalBytes = files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
    if (totalBytes > MAX_TOTAL_BASE64_BYTES) {
      return NextResponse.json(
        {
          error: `This push is too large (~${Math.round(totalBytes / 1024 / 1024)}MB). ` +
            `Check your .gitignore is excluding large/generated folders (node_modules, dist, build, etc.), ` +
            `or split the push into smaller batches.`,
        },
        { status: 413 },
      );
    }

    const result = await batchCommit(account.token, owner, repo, branch, files, message, basePath);
    return NextResponse.json({
      success: true,
      sha: result.sha,
      filesCommitted: result.fileCount,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
