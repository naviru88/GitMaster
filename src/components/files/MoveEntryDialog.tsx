'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, FolderInput } from 'lucide-react';
import { github } from '@/services/api';
import { useAppStore } from '@/store/appStore';
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
import FolderPicker from './FolderPicker';
import type { GitHubContent } from '@/types';

interface MoveEntryDialogProps {
  entry: GitHubContent | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}

export default function MoveEntryDialog({
  entry,
  onOpenChange,
  onMoved,
}: MoveEntryDialogProps) {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);

  const [destinationFolder, setDestinationFolder] = useState('');
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = entry !== null;

  React.useEffect(() => {
    if (entry) {
      setNewName(entry.name);
      const parentPath = entry.path.includes('/')
        ? entry.path.substring(0, entry.path.lastIndexOf('/'))
        : '';
      setDestinationFolder(parentPath);
      setSubmitting(false);
    }
  }, [entry]);

  const handleSubmit = async () => {
    if (!entry || !selectedAccountId || !selectedRepo) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error('Name cannot be empty');
      return;
    }

    const targetPath = destinationFolder
      ? `${destinationFolder}/${trimmedName}`
      : trimmedName;

    if (targetPath === entry.path) {
      toast.info('Nothing changed');
      onOpenChange(false);
      return;
    }

    const isDir = entry.type === 'dir';

    if (isDir && targetPath.startsWith(entry.path + '/')) {
      toast.error('Cannot move a folder into itself');
      return;
    }

    setSubmitting(true);
    try {
      const result = await github.contents.move(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch,
        entry.path,
        targetPath,
        isDir,
        isDir ? `Move ${entry.path}/ to ${targetPath}/` : `Move ${entry.path} to ${targetPath}`,
      );

      toast.success(`Moved to ${targetPath}`, {
        description: `${result.filesMoved} file(s) · commit ${result.sha.slice(0, 7)}`,
      });
      onMoved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="size-4" />
            Move {entry?.type === 'dir' ? 'folder' : 'file'}
          </DialogTitle>
          <DialogDescription>
            Pick a destination folder and optionally rename. This creates a single commit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Moving</p>
            <code className="font-mono text-xs break-all">{entry?.path}</code>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Destination folder</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs truncate">
                {destinationFolder || '/ (root)'}
              </code>
            </div>
            <FolderPicker
              accountId={selectedAccountId || ''}
              owner={selectedRepo?.owner.login || ''}
              repo={selectedRepo?.name || ''}
              branch={selectedBranch || undefined}
              selected={destinationFolder}
              onSelect={setDestinationFolder}
              excludePaths={
                entry?.type === 'dir'
                  ? [entry.path]
                  : []
              }
              allowCreate
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="move-name">
              {entry?.type === 'dir' ? 'Folder' : 'File'} name
            </Label>
            <Input
              id="move-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={submitting}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Will move to</p>
            <code className="font-mono text-xs break-all">
              {destinationFolder ? `${destinationFolder}/${newName || '…'}` : newName || '…'}
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <FolderInput className="size-3.5" />}
            {submitting ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
