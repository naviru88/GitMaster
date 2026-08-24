'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import type { GitHubRepo } from '@/types';

interface EditRepoNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  repository: GitHubRepo;
  onUpdated: (repository: GitHubRepo) => void;
}

export default function EditRepoNameDialog({
  open, onOpenChange, accountId, repository, onUpdated,
}: EditRepoNameDialogProps) {
  const [name, setName] = useState(repository.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(repository.name);
  }, [open, repository.name]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && trimmedName !== repository.name && !saving;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const updated = await github.repos.updateName(
        accountId,
        repository.owner.login,
        repository.name,
        trimmedName,
      );
      toast.success(`Repository renamed to ${updated.name}.`);
      onOpenChange(false);
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename repository.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename repository</DialogTitle>
          <DialogDescription>
            Change the repository name on GitHub. GitHub will redirect the old URL, but update any local links or integrations that use it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="repository-name">Repository name</Label>
            <Input
              id="repository-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="my-repository"
              disabled={saving}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Current name: <code className="rounded bg-muted px-1 font-mono">{repository.name}</code>
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Rename repository
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}