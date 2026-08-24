'use client';

import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { github } from '@/services/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  owner: string;
  repo: string;
  onDeleted: () => void;
}

export default function DeleteRepoDialog({
  open,
  onOpenChange,
  accountId,
  owner,
  repo,
  onDeleted,
}: DeleteRepoDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const matches = confirmation === repo;

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!matches || loading) return;

    setLoading(true);
    try {
      await github.repos.delete(accountId, owner, repo);
      toast.success(`Repository "${repo}" deleted.`);
      setConfirmation('');
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete repository.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !loading) setConfirmation('');
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Delete repository?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <strong>{owner}/{repo}</strong> from GitHub.
            All code, issues, pull requests, and settings will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-repository-confirmation">
            Type <code className="rounded bg-muted px-1 font-mono text-xs">{repo}</code> to confirm
          </Label>
          <Input
            id="delete-repository-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={repo}
            disabled={loading}
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!matches || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}