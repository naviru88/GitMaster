'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Folder,
  File,
  FileText,
  FileCode,
  Image as ImageIcon,
  Plus,
  FolderUp,
  Download,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PushFolderDialog from './PushFolderDialog';
import PullDialog from './PullDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GitHubContent } from '@/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext || '')) {
    return <ImageIcon className="size-4 text-muted-foreground" />;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'html', 'css', 'scss', 'less', 'sql', 'r', 'lua', 'vim', 'yml', 'yaml', 'toml', 'json', 'xml', 'graphql'].includes(ext || '')) {
    return <FileCode className="size-4 text-muted-foreground" />;
  }
  if (['md', 'mdx', 'txt', 'doc', 'docx', 'pdf', 'rtf', 'csv'].includes(ext || '')) {
    return <FileText className="size-4 text-muted-foreground" />;
  }
  return <File className="size-4 text-muted-foreground" />;
}

export default function FileBrowser() {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const filePath = useAppStore((s) => s.filePath);
  const setFilePath = useAppStore((s) => s.setFilePath);
  const fileContents = useAppStore((s) => s.fileContents);
  const setFileContents = useAppStore((s) => s.setFileContents);
  const setOpenedFile = useAppStore((s) => s.setOpenedFile);

  const [loading, setLoading] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [pushOpen, setPushOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);

  const fetchContents = useCallback(async (path: string) => {
    if (!selectedAccountId || !selectedRepo) return;
    setLoading(true);
    try {
      const contents = await github.contents.list(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        path,
        selectedBranch || undefined,
      );
      setFileContents(contents);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contents.');
      setFileContents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, selectedRepo, selectedBranch, setFileContents]);

  useEffect(() => {
    fetchContents(filePath);
  }, [filePath, fetchContents]);

  const handleDirClick = (item: GitHubContent) => {
    setFilePath(item.path);
  };

  const handleFileClick = async (item: GitHubContent) => {
    if (!selectedAccountId || !selectedRepo) return;
    try {
      const file = await github.contents.getFile(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        item.path,
        selectedBranch || undefined,
      );
      const decoded = file.content ? atob(file.content.replace(/\n/g, '')) : '';
      setOpenedFile({ content: file, decoded });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load file.');
    }
  };

  const handleNewFile = () => {
    if (!newFileName.trim()) return;
    if (!selectedAccountId || !selectedRepo) return;
    const path = filePath ? `${filePath}/${newFileName.trim()}` : newFileName.trim();
    setOpenedFile({
      content: {
        name: newFileName.trim(),
        path,
        sha: '',
        size: 0,
        url: '',
        html_url: null,
        git_url: null,
        type: 'file',
      },
      decoded: '',
    });
    setNewFileName('');
    setNewFileOpen(false);
  };

  const pathSegments = filePath ? filePath.split('/') : [];

  const sortedContents = [...fileContents].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Path breadcrumb + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer font-mono text-xs"
                onClick={() => setFilePath('')}
              >
                {selectedRepo?.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {pathSegments.map((seg, i) => {
              const path = pathSegments.slice(0, i + 1).join('/');
              const isLast = i === pathSegments.length - 1;
              return (
                <React.Fragment key={path}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-mono text-xs">{seg}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        className="cursor-pointer font-mono text-xs"
                        onClick={() => setFilePath(path)}
                      >
                        {seg}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPushOpen(true)}>
            <FolderUp className="size-3.5" />
            Push Folder
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPullOpen(true)}>
            <Download className="size-3.5" />
            Pull
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNewFileOpen(true)}>
            <Plus className="size-3.5" />
            New File
          </Button>
        </div>
      </div>

      {/* File table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : sortedContents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {filePath ? 'This directory is empty.' : 'No files in repository root.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContents.map((item) => (
              <TableRow
                key={item.sha}
                className="cursor-pointer"
                onClick={() =>
                  item.type === 'dir' ? handleDirClick(item) : handleFileClick(item)
                }
              >
                <TableCell className="w-10">
                  {item.type === 'dir' ? (
                    <Folder className="size-4 text-muted-foreground" />
                  ) : (
                    getFileIcon(item.name)
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{item.name}</TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {item.type === 'file' ? formatSize(item.size) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Push / Pull dialogs */}
      <PushFolderDialog
        open={pushOpen}
        onOpenChange={setPushOpen}
        onSuccess={() => fetchContents(filePath)}
      />
      <PullDialog open={pullOpen} onOpenChange={setPullOpen} />

      {/* New file dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-file-name">File name</Label>
            <Input
              id="new-file-name"
              placeholder="example.txt"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewFile()}
              autoFocus
            />
            {filePath && (
              <p className="text-xs text-muted-foreground">
                Will be created at: {filePath}/{newFileName || '...'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileOpen(false)}>Cancel</Button>
            <Button onClick={handleNewFile} disabled={!newFileName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
