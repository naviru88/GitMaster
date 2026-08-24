'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { accounts } from '@/services/api';
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

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const addAccount = useAppStore((s) => s.addAccount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !token.trim()) {
      setError('Both fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await accounts.create({ label: label.trim(), token: token.trim() });
      addAccount(result);
      toast.success(`Account "${result.label}" connected!`);
      setLabel('');
      setToken('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setError(''); setLabel(''); setToken(''); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add GitHub Account</DialogTitle>
          <DialogDescription>
            Connect a GitHub account using a Personal Access Token.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              placeholder="e.g. Work, Personal"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="token">GitHub Personal Access Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="ghp_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
