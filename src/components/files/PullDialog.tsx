'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, GitBranch } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

interface PullDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PullDialog({ open, onOpenChange }: PullDialogProps) {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const branches = useAppStore((s) => s.branches);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [format, setFormat] = useState<'zip' | 'tar.gz'>('zip');
  const [pulling, setPulling] = useState(false);

  const activeBranch = useAppStore((s) => s.selectedBranch);

  React.useEffect(() => {
    if (open) setSelectedBranch(activeBranch || '');
  }, [open, activeBranch]);

  const handlePull = async () => {
    if (!selectedAccountId || !selectedRepo || !selectedBranch) return;
    setPulling(true);
    try {
      const blob = await github.pull.download(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch,
        format,
      );
      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedRepo.name}-${selectedBranch}.${format === 'zip' ? 'zip' : 'tar.gz'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${selectedRepo.name} (${selectedBranch})`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pull failed.');
    } finally {
      setPulling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Pull from {selectedRepo?.name}
          </DialogTitle>
          <DialogDescription>
            Download the repository as an archive to your local machine.
            This is equivalent to <code className="rounded bg-muted px-1 text-xs font-mono">git clone</code> or{' '}
            <code className="rounded bg-muted px-1 text-xs font-mono">git pull</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Branch selection */}
          <div className="flex flex-col gap-2">
            <Label>Branch</Label>
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-muted-foreground" />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={pulling}
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Format selection */}
          <div className="flex flex-col gap-2">
            <Label>Archive Format</Label>
            <div className="flex gap-2">
              <Button
                variant={format === 'zip' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('zip')}
                disabled={pulling}
                className="flex-1"
              >
                .zip (recommended)
              </Button>
              <Button
                variant={format === 'tar.gz' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('tar.gz')}
                disabled={pulling}
                className="flex-1"
              >
                .tar.gz
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pulling}>
            Cancel
          </Button>
          <Button onClick={handlePull} disabled={pulling || !selectedBranch} className="gap-1.5">
            {pulling ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {pulling ? 'Downloading...' : 'Pull'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
