'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
import type { GitHubRepo } from '@/types';

interface ChangeVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  repository: GitHubRepo;
  onUpdated: (repository: GitHubRepo) => void;
}

export default function ChangeVisibilityDialog({
  open,
  onOpenChange,
  accountId,
  repository,
  onUpdated,
}: ChangeVisibilityDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const makePrivate = !repository.private;
  const actionLabel = makePrivate ? 'private' : 'public';
  const matches = confirmation === repository.name;

  const handleUpdate = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!matches || loading) return;

    setLoading(true);
    try {
      const updated = await github.repos.updateVisibility(
        accountId,
        repository.owner.login,
        repository.name,
        makePrivate,
      );
      toast.success(`Repository is now ${actionLabel}.`);
      setConfirmation('');
      onOpenChange(false);
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update repository visibility.');
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
          <AlertDialogTitle className="flex items-center gap-2">
            {makePrivate ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            Make repository {actionLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This changes the GitHub visibility of <strong>{repository.full_name}</strong> to {actionLabel}.
            {makePrivate
              ? ' Existing public forks will not automatically become private.'
              : ' Anyone will be able to view the repository and its code.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="visibility-repository-confirmation">
            Type <code className="rounded bg-muted px-1 font-mono text-xs">{repository.name}</code> to confirm
          </Label>
          <Input
            id="visibility-repository-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={repository.name}
            disabled={loading}
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate} disabled={!matches || loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Make {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}