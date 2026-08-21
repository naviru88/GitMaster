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
import { Progress } from '@/components/ui/progress';

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
  const [pullProgress, setPullProgress] = useState(0);

  const activeBranch = useAppStore((s) => s.selectedBranch);

  React.useEffect(() => {
    if (open) setSelectedBranch(activeBranch || '');
  }, [open, activeBranch]);

  const handlePull = async () => {
    if (!selectedAccountId || !selectedRepo || !selectedBranch) return;
    setPulling(true);
    setPullProgress(0);
    const toastId = toast.loading(`Downloading ${selectedRepo.name} (${selectedBranch})…`, {
      description: `Fetching ${format} archive from GitHub — this can take a moment for larger repos.`,
    });

    // We don't get real byte-level progress from a single fetch-a-blob call,
    // so simulate a steady climb toward 90% while the request is in flight
    // (never claiming 100% until it's actually done) — this is what gives
    // the visible "still working" motion rather than a static/frozen bar.
    const simInterval = setInterval(() => {
      setPullProgress((p) => (p < 90 ? p + (90 - p) * 0.1 : p));
    }, 250);

    try {
      const blob = await github.pull.download(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch,
        format,
      );
      clearInterval(simInterval);
      setPullProgress(100);
      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedRepo.name}-${selectedBranch}.${format === 'zip' ? 'zip' : 'tar.gz'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${selectedRepo.name} (${selectedBranch})`, {
        id: toastId,
        description: `${(blob.size / 1024 / 1024).toFixed(1)}MB saved to your downloads.`,
      });
      onOpenChange(false);
    } catch (err) {
      clearInterval(simInterval);
      toast.error('Download failed', {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unknown error — please try again.',
      });
    } finally {
      setPulling(false);
      setPullProgress(0);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && pulling) {
          toast.info('Download in progress — please wait for it to finish.');
          return;
        }
        onOpenChange(v);
      }}
    >
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

        {/* Always-visible download progress — placed right under the header,
            never inside a scrollable area, so it can't be missed. */}
        {pulling && (
          <div className="shrink-0 flex flex-col gap-1.5 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Downloading…
              </span>
              <span className="text-muted-foreground">{Math.round(pullProgress)}%</span>
            </div>
            <Progress value={pullProgress} className="h-2" />
          </div>
        )}

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
