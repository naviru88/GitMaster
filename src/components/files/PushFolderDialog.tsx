'use client';

import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, FolderUp, Loader2, X, FileText } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PushFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FileItem {
  name: string;
  relativePath: string;
  size: number;
  file: File;
}

export default function PushFolderDialog({ open, onOpenChange, onSuccess }: PushFolderDialogProps) {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const filePath = useAppStore((s) => s.filePath);

  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    const items: FileItem[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      items.push({
        name: f.name,
        relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        size: f.size,
        file: f,
      });
    }
    setFiles(items);
    if (!commitMessage) {
      setCommitMessage(`Push ${items.length} files from local folder`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    const items: FileItem[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      items.push({
        name: f.name,
        relativePath: f.name,
        size: f.size,
        file: f,
      });
    }
    setFiles(items);
    if (!commitMessage) {
      setCommitMessage(`Add ${items.length} file(s)`);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePush = async () => {
    if (!selectedAccountId || !selectedRepo || files.length === 0) return;
    const msg = commitMessage.trim() || 'Push files';
    const branch = selectedBranch || selectedRepo.default_branch;

    setPushing(true);
    setProgress(0);

    try {
      // Read all files as base64
      const fileData: Array<{ path: string; content: string; isBase64: boolean }> = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const buffer = await f.file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        // Use relative path (strip the root folder name if from directory picker)
        const relativePath = f.relativePath.includes('/')
          ? f.relativePath.split('/').slice(1).join('/')
          : f.relativePath;
        fileData.push({ path: relativePath, content: base64, isBase64: true });
        setProgress(Math.round(((i + 1) / files.length) * 70));
      }

      // Send to backend for batch commit
      const result = await github.push.batch(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        branch,
        fileData,
        msg,
        filePath || undefined,
      );

      setProgress(100);
      toast.success(`Pushed ${result.filesCommitted} file(s) in commit ${result.sha.slice(0, 7)}`);
      setFiles([]);
      setCommitMessage('');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Push failed.');
    } finally {
      setPushing(false);
      setProgress(0);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setFiles([]); setCommitMessage(''); setProgress(0); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderUp className="size-5" />
            Push to {selectedRepo?.name}
          </DialogTitle>
          <DialogDescription>
            Upload files from your local machine. All files will be committed in a single operation.
            <br />
            <span className="text-xs text-muted-foreground">
              Branch: <code className="rounded bg-muted px-1 font-mono">{selectedBranch || selectedRepo?.default_branch}</code>
              {filePath && <span> &middot; Path: <code className="rounded bg-muted px-1 font-mono">{filePath}</code></span>}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* File selection buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => folderRef.current?.click()}
              disabled={pushing}
            >
              <FolderUp className="size-4" />
              Select Folder
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => filesRef.current?.click()}
              disabled={pushing}
            >
              <Upload className="size-4" />
              Select Files
            </Button>
            <input
              ref={folderRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              className="hidden"
              onChange={handleFolderSelect}
            />
            <input
              ref={filesRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
                <span>{files.length} file(s) selected</span>
                <span>{formatSize(totalSize)}</span>
              </div>
              <ScrollArea className="max-h-48">
                <div className="divide-y">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm group">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate font-mono text-xs" title={f.relativePath}>{f.relativePath}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                      {!pushing && (
                        <button
                          onClick={() => removeFile(i)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Commit message */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="push-msg">Commit message</Label>
            <Input
              id="push-msg"
              placeholder="e.g. Add new feature files"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={pushing}
            />
          </div>

          {/* Progress */}
          {pushing && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  {progress < 70 ? 'Reading files...' : 'Committing to GitHub...'}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pushing}>
            Cancel
          </Button>
          <Button onClick={handlePush} disabled={pushing || files.length === 0 || !commitMessage.trim()} className="gap-1.5">
            {pushing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {pushing ? 'Pushing...' : 'Push Files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
