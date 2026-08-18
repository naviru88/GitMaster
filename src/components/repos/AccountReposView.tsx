'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Search, Plus, Star, GitFork, EyeOff, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CreateRepoDialog from './CreateRepoDialog';
import type { GitHubRepo } from '@/types';

export default function AccountReposView() {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const repos = useAppStore((s) => s.repos);
  const setRepos = useAppStore((s) => s.setRepos);
  const setSelectedRepo = useAppStore((s) => s.setSelectedRepo);
  const setSelectedBranch = useAppStore((s) => s.setSelectedBranch);
  const setView = useAppStore((s) => s.setView);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchRepos = useCallback(async (q = '', pg = 1, append = false) => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      if (q) {
        const result = await github.repos.search(selectedAccountId, q, pg);
        setRepos(append ? [...repos, ...result.items] : result.items);
        setHasMore(result.items.length >= 30);
      } else {
        const result = await github.repos.list(selectedAccountId, pg);
        setRepos(append ? [...repos, ...result.items] : result.items);
        setHasMore(result.items.length >= 30);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch repos.');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, repos, setRepos]);

  useEffect(() => {
    setPage(1);
    setRepos([]);
    setHasMore(true);
    fetchRepos(search, 1, false);
  }, [selectedAccountId]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchRepos(val, 1, false);
    }, 400);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRepos(search, nextPage, true);
  };

  const handleRepoClick = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setView('repo-detail');
  };

  if (!selectedAccountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Please select an account.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Repos</h1>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search repos..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Repo</span>
            </Button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && repos.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-8 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && repos.length === 0 && (
          <Card className="max-w-md mx-auto text-center py-10">
            <CardContent className="flex flex-col items-center gap-3">
              <p className="text-muted-foreground">
                {search ? 'No repositories match your search.' : 'No repositories found.'}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="size-4" />
                  Create Repo
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Repo grid */}
        {repos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map((repo) => (
              <Card
                key={repo.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRepoClick(repo)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardTitle className="text-base truncate">{repo.name}</CardTitle>
                      </TooltipTrigger>
                      <TooltipContent>{repo.full_name}</TooltipContent>
                    </Tooltip>
                    {repo.private && (
                      <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                        <EyeOff className="size-3" />
                        Private
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                        {repo.description || 'No description'}
                      </p>
                    </TooltipTrigger>
                    {repo.description && repo.description.length > 100 && (
                      <TooltipContent>{repo.description}</TooltipContent>
                    )}
                  </Tooltip>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground gap-3">
                  {repo.language && <Badge variant="outline" className="text-xs font-normal">{repo.language}</Badge>}
                  <span className="flex items-center gap-1"><Star className="size-3" />{repo.stargazers_count}</span>
                  <span className="flex items-center gap-1"><GitFork className="size-3" />{repo.forks_count}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Load more */}
        {repos.length > 0 && hasMore && (
          <div className="flex justify-center mt-6">
            <Button variant="outline" onClick={loadMore} disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Load More
            </Button>
          </div>
        )}

        <CreateRepoDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          accountId={selectedAccountId}
          onCreated={() => fetchRepos(search, 1, false)}
        />
      </div>
    </TooltipProvider>
  );
}