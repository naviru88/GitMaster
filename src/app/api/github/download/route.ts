import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getContents, getFile } from '@/lib/github';
import { githubError } from '@/lib/errors';
import { requireAuth, AuthError } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { gzipSync } from 'node:zlib';

type ArchiveEntry = { path: string; content: Buffer };

function writeString(buffer: Buffer, offset: number, length: number, value: string) {
  buffer.write(value.slice(0, length), offset, length, 'utf8');
}

function tarHeader(path: string, size: number): Buffer {
  const header = Buffer.alloc(512);
  writeString(header, 0, 100, path);
  writeString(header, 100, 8, '0000644\0');
  writeString(header, 108, 8, '0000000\0');
  writeString(header, 116, 8, '0000000\0');
  writeString(header, 124, 12, `${size.toString(8).padStart(11, '0')}\0`);
  writeString(header, 136, 12, `${Math.floor(Date.now() / 1000).toString(8).padStart(11, '0')}\0`);
  header.fill(0x20, 148, 156);
  header[156] = 0x30; // regular file
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  return header;
}

function createTarGz(entries: ArchiveEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    chunks.push(tarHeader(entry.path, entry.content.length), entry.content);
    const padding = (512 - (entry.content.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    const owner = req.nextUrl.searchParams.get('owner');
    const repo = req.nextUrl.searchParams.get('repo');
    const path = req.nextUrl.searchParams.get('path') || '';
    const ref = req.nextUrl.searchParams.get('ref') || undefined;

    if (!accountId || !owner || !repo || !path) {
      return NextResponse.json({ error: 'accountId, owner, repo, and path are required' }, { status: 400 });
    }
    const account = await db.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const token = account.token ? decrypt(account.token) : undefined;

    const item = await getFile(token, owner, repo, path, ref).catch(() => null);
    let entries: ArchiveEntry[] = [];
    let filename = path.split('/').pop() || 'download';

    if (item && !Array.isArray(item) && item.type === 'file') {
      if (item.content === undefined) {
        return NextResponse.json({ error: 'This file is too large to download through the API.' }, { status: 413 });
      }
      entries = [{ path: item.name, content: Buffer.from(item.content.replace(/\n/g, ''), 'base64') }];
    } else {
      const collect = async (folder: string, prefix: string) => {
        const children = await getContents(token, owner, repo, folder, ref);
        for (const child of children) {
          const archivePath = prefix ? `${prefix}/${child.name}` : child.name;
          if (child.type === 'dir') {
            await collect(child.path, archivePath);
          } else {
            const file = await getFile(token, owner, repo, child.path, ref);
            if (!Array.isArray(file) && file.content !== undefined) {
              entries.push({
                path: archivePath,
                content: Buffer.from(file.content.replace(/\n/g, ''), 'base64'),
              });
            }
          }
        }
      };
      await collect(path, filename);
      filename = `${filename}.tar.gz`;
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No downloadable files found.' }, { status: 404 });
    }
    const archive = createTarGz(entries);
    return new NextResponse(archive, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    const { message, status } = githubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}