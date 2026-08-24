'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Star, GitFork, ExternalLink, ShieldCheck, Trash2, Eye, EyeOff, Pencil } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FileBrowser from '@/components/files/FileBrowser';
import BranchManager from '@/components/branches/BranchManager';
import CommitList from '@/components/commits/CommitList';
import DeleteRepoDialog from './DeleteRepoDialog';
import ChangeVisibilityDialog from './ChangeVisibilityDialog';
import EditRepoDescriptionDialog from './EditRepoDescriptionDialog';
import type { RepoTab } from '@/types';

export default function RepoDetailView() {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const repoTab = useAppStore((s) => s.repoTab);
  const setRepoTab = useAppStore((s) => s.setRepoTab);
  const setBranches = useAppStore((s) => s.setBranches);
  const setCommits = useAppStore((s) => s.setCommits);
  const repos = useAppStore((s) => s.repos);
  const setRepos = useAppStore((s) => s.setRepos);
  const setSelectedRepo = useAppStore((s) => s.setSelectedRepo);
  const setView = useAppStore((s) => s.setView);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const fetchBranches = useCallback(async () => {
    if (!selectedAccountId || !selectedRepo) return;
    try {
      const b = await github.branches.list(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
      );
      setBranches(b);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch branches.');
    }
  }, [selectedAccountId, selectedRepo, setBranches]);

  const fetchCommits = useCallback(async () => {
    if (!selectedAccountId || !selectedRepo) return;
    try {
      const c = await github.commits.list(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch || undefined,
      );
      setCommits(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch commits.');
    }
  }, [selectedAccountId, selectedRepo, selectedBranch, setCommits]);

  useEffect(() => {
    if (selectedRepo && selectedAccountId) {
      fetchBranches();
      fetchCommits();
    }
  }, [selectedRepo, selectedAccountId, fetchBranches, fetchCommits]);

  if (!selectedRepo || !selectedAccountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No repository selected.
      </div>
    );
  }

  const tabValue: string = repoTab;
  const handleDeleted = () => {
    setRepos(repos.filter((repo) => repo.id !== selectedRepo.id));
    setSelectedRepo(null);
    setView('account-repos');
  };
  const handleVisibilityUpdated = (updatedRepo: typeof selectedRepo) => {
    if (!updatedRepo) return;
    setSelectedRepo(updatedRepo);
    setRepos(repos.map((repo) => repo.id === updatedRepo.id ? updatedRepo : repo));
  };
  const handleRepoUpdated = (updatedRepo: typeof selectedRepo) => {
    if (!updatedRepo) return;
    setSelectedRepo(updatedRepo);
    setRepos(repos.map((repo) => repo.id === updatedRepo.id ? updatedRepo : repo));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">{selectedRepo.full_name}</h1>
              {selectedRepo.private && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ShieldCheck className="size-3" />
                  Private
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {selectedRepo.description || 'No description'}
              </p>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setDescriptionOpen(true)} title="Edit description">
                <Pencil className="size-3.5" />
                <span className="sr-only">Edit description</span>
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              {selectedRepo.language && (
                <Badge variant="outline" className="text-xs font-normal">{selectedRepo.language}</Badge>
              )}
              <span className="flex items-center gap-1"><Star className="size-3.5" />{selectedRepo.stargazers_count}</span>
              <span className="flex items-center gap-1"><GitFork className="size-3.5" />{selectedRepo.forks_count}</span>
              <span className="text-xs">Branch: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{selectedBranch}</code></span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href={selectedRepo.html_url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="size-3.5" />
                GitHub
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibilityOpen(true)}
              className="gap-1.5"
            >
              {selectedRepo.private ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {selectedRepo.private ? 'Make public' : 'Make private'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tabValue} onValueChange={(v) => setRepoTab(v as RepoTab)}>
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="commits">Commits</TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="mt-4">
          <FileBrowser />
        </TabsContent>
        <TabsContent value="branches" className="mt-4">
          <BranchManager />
        </TabsContent>
        <TabsContent value="commits" className="mt-4">
          <CommitList />
        </TabsContent>
      </Tabs>
      <DeleteRepoDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        accountId={selectedAccountId}
        owner={selectedRepo.owner.login}
        repo={selectedRepo.name}
        onDeleted={handleDeleted}
      />
      <ChangeVisibilityDialog
        open={visibilityOpen}
        onOpenChange={setVisibilityOpen}
        accountId={selectedAccountId}
        repository={selectedRepo}
        onUpdated={handleVisibilityUpdated}
      />
      <EditRepoDescriptionDialog
        open={descriptionOpen}
        onOpenChange={setDescriptionOpen}
        accountId={selectedAccountId}
        repository={selectedRepo}
        onUpdated={handleRepoUpdated}
      />
    </div>
  );
}
