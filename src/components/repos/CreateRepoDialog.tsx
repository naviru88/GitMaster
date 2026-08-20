'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface CreateRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onCreated: () => void;
}

export default function CreateRepoDialog({ open, onOpenChange, accountId, onCreated }: CreateRepoDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Repository name is required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await github.repos.create(accountId, {
        name: name.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
      });
      toast.success(`Repository "${name.trim()}" created!`);
      setName('');
      setDescription('');
      setIsPrivate(false);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setError(''); setName(''); setDescription(''); setIsPrivate(false); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Repository</DialogTitle>
          <DialogDescription>Create a new repository on GitHub.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="repo-name">Name</Label>
            <Input
              id="repo-name"
              placeholder="my-awesome-repo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="repo-desc">Description</Label>
            <Textarea
              id="repo-desc"
              placeholder="A brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="repo-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={loading}
            />
            <Label htmlFor="repo-private" className="cursor-pointer">Private repository</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
