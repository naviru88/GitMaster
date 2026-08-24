'use client';

import React, { useEffect, useState } from 'react';
import { Clock3, Loader2, GitCommit } from 'lucide-react';
import { toast } from 'sonner';
import { github } from '@/services/api';
import type { GitHubCommit, GitHubContent } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  owner: string;
  repo: string;
  branch: string;
  file: GitHubContent;
}

export default function VersionHistoryDialog({
  open, onOpenChange, accountId, owner, repo, branch, file,
}: VersionHistoryDialogProps) {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [selected, setSelected] = useState<GitHubCommit | null>(null);
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    setVersion('');
    github.commits.list(accountId, owner, repo, branch || undefined, 1, file.path)
      .then(setCommits)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load file history.'))
      .finally(() => setLoading(false));
  }, [open, accountId, owner, repo, branch, file.path]);

  const loadVersion = async (commit: GitHubCommit) => {
    setSelected(commit);
    setLoadingVersion(true);
    try {
      const historical = await github.contents.getFile(accountId, owner, repo, file.path, commit.sha);
      setVersion(historical.content ? atob(historical.content.replace(/\n/g, '')) : '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load this file version.');
      setVersion('');
    } finally {
      setLoadingVersion(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock3 className="size-5" />
            File versions
          </DialogTitle>
          <DialogDescription>
            Commits that changed <code className="rounded bg-muted px-1 font-mono text-xs">{file.path}</code>.
            Select a commit to view its contents. Your current file is not changed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-0 flex-1">
          <ScrollArea className="border rounded-md max-h-[55vh]">
            <div className="p-2 space-y-1">
              {loading && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading history…
                </div>
              )}
              {!loading && commits.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No commit history found.</p>
              )}
              {commits.map((commit) => (
                <Button
                  key={commit.sha}
                  variant={selected?.sha === commit.sha ? 'secondary' : 'ghost'}
                  className="w-full h-auto justify-start items-start gap-2 text-left py-2"
                  onClick={() => loadVersion(commit)}
                >
                  <GitCommit className="size-4 mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs">{commit.commit.message.split('\n')[0]}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(commit.commit.author.date).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="mt-1 font-mono text-[10px]">{commit.sha.slice(0, 7)}</Badge>
                  </span>
                </Button>
              ))}
            </div>
          </ScrollArea>
          <div className="min-h-[300px] border rounded-md overflow-hidden bg-muted/20">
            {loadingVersion ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading version…
              </div>
            ) : selected ? (
              <pre className="h-full max-h-[55vh] overflow-auto p-4 text-xs font-mono whitespace-pre-wrap">
                {version}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select a commit to view that version.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}