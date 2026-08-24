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

interface EditRepoDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  repository: GitHubRepo;
  onUpdated: (repository: GitHubRepo) => void;
}

export default function EditRepoDescriptionDialog({
  open, onOpenChange, accountId, repository, onUpdated,
}: EditRepoDescriptionDialogProps) {
  const [description, setDescription] = useState(repository.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDescription(repository.description || '');
  }, [open, repository.description]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await github.repos.updateDescription(
        accountId,
        repository.owner.login,
        repository.name,
        description.trim(),
      );
      toast.success('Repository description updated.');
      onOpenChange(false);
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update description.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit repository description</DialogTitle>
          <DialogDescription>
            Update the description shown on GitHub for {repository.full_name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="repository-description">Description</Label>
            <Input
              id="repository-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={350}
              placeholder="What is this repository for?"
              disabled={saving}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/350</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save description
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}