'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GitHubCommit } from '@/types';

export default function CommitList() {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const commits = useAppStore((s) => s.commits);
  const setCommits = useAppStore((s) => s.setCommits);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchCommits = useCallback(async (pg: number, append: boolean) => {
    if (!selectedAccountId || !selectedRepo) return;
    setLoading(true);
    try {
      const result = await github.commits.list(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch || undefined,
        pg,
      );
      setCommits(append ? [...commits, ...result] : result);
      setHasMore(result.length >= 30);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch commits.');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, selectedRepo, selectedBranch, commits, setCommits]);

  useEffect(() => {
    setPage(1);
    setCommits([]);
    setHasMore(true);
    fetchCommits(1, false);
  }, [selectedAccountId, selectedRepo, selectedBranch]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCommits(nextPage, true);
  };

  const toggleExpand = (sha: string) => {
    setExpanded((prev) => (prev === sha ? null : sha));
  };

  return (
    <div>
      {/* Loading skeleton */}
      {loading && commits.length === 0 && (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-2">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && commits.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No commits found.
        </div>
      )}

      {/* Commit list */}
      <div className="space-y-1">
        {commits.map((commit) => {
          const firstLine = commit.commit.message.split('\n')[0];
          const isExpanded = expanded === commit.sha;
          return (
            <div
              key={commit.sha}
              className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => toggleExpand(commit.sha)}
            >
              <Avatar className="size-8 shrink-0 mt-0.5">
                <AvatarImage src={commit.author?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(commit.commit.author.name || '??').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{firstLine}</p>
                {isExpanded && commit.commit.message.includes('\n') && (
                  <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2">
                    {commit.commit.message}
                  </pre>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {commit.commit.author.name}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {commit.sha.slice(0, 7)}
                </code>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(commit.commit.author.date), { addSuffix: true })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {commits.length > 0 && hasMore && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
