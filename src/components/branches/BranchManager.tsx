'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, GitMerge, Trash2, Check, Loader2, Shield } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MergeConflictDialog from './MergeConflictDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function BranchManager() {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const branches = useAppStore((s) => s.branches);
  const setBranches = useAppStore((s) => s.setBranches);
  const setSelectedBranch = useAppStore((s) => s.setSelectedBranch);

  const [newBranchName, setNewBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [creating, setCreating] = useState(false);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

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

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Set default base branch
  useEffect(() => {
    if (branches.length > 0 && !baseBranch) {
      const defaultBranch = selectedRepo?.default_branch;
      const match = branches.find((b) => b.name === defaultBranch);
      setBaseBranch(match ? match.name : branches[0].name);
    }
  }, [branches, baseBranch, selectedRepo]);

  const handleCreateBranch = async () => {
    if (!selectedAccountId || !selectedRepo || !newBranchName.trim() || !baseBranch) return;
    setCreating(true);
    try {
      const base = branches.find((b) => b.name === baseBranch);
      if (!base) {
        toast.error('Base branch not found.');
        return;
      }
      await github.branches.create(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        newBranchName.trim(),
        base.commit.sha,
      );
      toast.success(`Branch "${newBranchName.trim()}" created!`);
      setNewBranchName('');
      fetchBranches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create branch.');
    } finally {
      setCreating(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedAccountId || !selectedRepo || !mergeSource || !mergeTarget) {
      toast.error('Select both source and target branches.');
      return;
    }
    if (mergeSource === mergeTarget) {
      toast.error('Source and target cannot be the same.');
      return;
    }
    setMerging(true);
    try {
      const result = await github.merge.merge(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        mergeTarget,
        mergeSource,
        `Merge ${mergeSource} into ${mergeTarget}`,
      );
      if (result.merged) {
        toast.success(`Merged ${mergeSource} into ${mergeTarget}`);
        setMergeSource('');
        setMergeTarget('');
        fetchBranches();
      } else {
        // GitHub can return a normal JSON response with merged:false instead
        // of throwing a 409. Keep both selections intact so the resolver can
        // use them, rather than clearing the state before it is rendered.
        toast.error(`${mergeSource} and ${mergeTarget} could not be merged`, {
          description: result.message || 'Opening the conflict resolver…',
          duration: 4000,
        });
        setConflictDialogOpen(true);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      // A 409 here means GitHub found overlapping changes it can't combine
      // automatically — this isn't something the app can resolve on its
      // own, it needs a human to pick which changes win. Give a clear,
      // actionable message instead of surfacing GitHub's raw JSON error.
      if (/^GitHub API 409:/.test(raw) || /merge conflict/i.test(raw)) {
        toast.error(`${mergeSource} and ${mergeTarget} have conflicting changes`, {
          description: 'Opening the conflict resolver…',
          duration: 4000,
        });
        setConflictDialogOpen(true);
      } else {
        toast.error(raw || 'Merge failed.');
      }
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!selectedAccountId || !selectedRepo) return;
    setDeleting(name);
    try {
      // GitHub API for deleting a branch uses the repo delete endpoint with specific handling
      // For now we show a message since branch deletion requires a specific API
      toast.error('Branch deletion via API is not supported. Please delete from GitHub directly.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete branch.');
    } finally {
      setDeleting(null);
    }
  };

  const defaultBranch = selectedRepo?.default_branch || '';

  return (
    <div className="flex flex-col space-y-6">
      {/* Create branch */}
      <Card className="order-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="New branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
              className="flex-1"
            />
            <Select value={baseBranch} onValueChange={setBaseBranch}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Base branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreateBranch} disabled={creating || !newBranchName.trim()} className="gap-1.5 shrink-0">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Merge branches */}
      <Card className="order-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Merge Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={mergeSource} onValueChange={setMergeSource}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Source branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="self-center text-sm text-muted-foreground hidden sm:block">into</span>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Target branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleMerge} disabled={merging || !mergeSource || !mergeTarget} className="gap-1.5 shrink-0">
              {merging ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
              Merge
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="order-4" />

      {/* Branches table */}
      <div className="order-1">
        <h3 className="text-base font-semibold mb-3">All Branches</h3>
        {branches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No branches found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Latest SHA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">{branch.name}</code>
                      {branch.name === selectedBranch && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Check className="size-3" />
                          Active
                        </Badge>
                      )}
                      {branch.name === defaultBranch && (
                        <Badge variant="outline" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground font-mono">{branch.commit.sha.slice(0, 7)}</code>
                  </TableCell>
                  <TableCell>
                    {branch.protected && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Shield className="size-3" />
                        Protected
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {branch.name !== selectedBranch && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBranch(branch.name)}
                          className="gap-1 text-xs"
                        >
                          <Check className="size-3" />
                          Set Active
                        </Button>
                      )}
                      {branch.name !== defaultBranch && branch.name !== selectedBranch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(branch.name)}
                          disabled={deleting === branch.name}
                        >
                          {deleting === branch.name ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedAccountId && selectedRepo && mergeSource && mergeTarget && (
        <MergeConflictDialog
          open={conflictDialogOpen}
          onOpenChange={setConflictDialogOpen}
          accountId={selectedAccountId}
          owner={selectedRepo.owner.login}
          repo={selectedRepo.name}
          base={mergeTarget}
          head={mergeSource}
          onResolved={() => {
            setMergeSource('');
            setMergeTarget('');
            fetchBranches();
          }}
        />
      )}
    </div>
  );
}
