'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, GitMerge, Trash2, Check, Loader2, Shield, Edit2, X, AlertTriangle, Users } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  // Branch Deletion states
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Branch Renaming states
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [newBranchEditName, setNewBranchEditName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Collaborator / push permissions check
  const hasPushAccess = selectedRepo?.permissions ? selectedRepo.permissions.push : true;

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
      toast.success(`Branch "${newBranchName.trim()}" created successfully!`);
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
      toast.error('Source and target branches cannot be the same.');
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
        toast.error(`${mergeSource} and ${mergeTarget} could not be merged automatically`, {
          description: result.message || 'Opening the conflict resolver…',
          duration: 4000,
        });
        setConflictDialogOpen(true);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (/409/i.test(raw) || /conflict/i.test(raw)) {
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

  const confirmDelete = (name: string) => {
    setDeletingBranch(name);
    setDeleteConfirmOpen(true);
  };

  const handleExecuteDelete = async () => {
    if (!selectedAccountId || !selectedRepo || !deletingBranch) return;
    setIsDeleting(true);
    try {
      await github.branches.delete(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        deletingBranch,
      );
      toast.success(`Branch "${deletingBranch}" deleted successfully.`);
      if (selectedBranch === deletingBranch) {
        setSelectedBranch(defaultBranch || (branches.find((b) => b.name !== deletingBranch)?.name ?? ''));
      }
      setDeleteConfirmOpen(false);
      setDeletingBranch(null);
      fetchBranches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete branch.');
    } finally {
      setIsDeleting(false);
    }
  };

  const startRename = (name: string) => {
    setEditingBranch(name);
    setNewBranchEditName(name);
  };

  const cancelRename = () => {
    setEditingBranch(null);
    setNewBranchEditName('');
  };

  const handleExecuteRename = async (oldName: string) => {
    const trimmed = newBranchEditName.trim();
    if (!trimmed || trimmed === oldName) {
      cancelRename();
      return;
    }
    if (!selectedAccountId || !selectedRepo) return;
    setIsRenaming(true);
    try {
      await github.branches.rename(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        oldName,
        trimmed,
      );
      toast.success(`Branch "${oldName}" renamed to "${trimmed}".`);
      if (selectedBranch === oldName) {
        setSelectedBranch(trimmed);
      }
      cancelRename();
      fetchBranches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename branch.');
    } finally {
      setIsRenaming(false);
    }
  };

  const defaultBranch = selectedRepo?.default_branch || '';

  return (
    <div className="flex flex-col space-y-6">
      {/* Team / Collaborator Access Notice */}
      {selectedRepo && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border text-sm">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Access level:</span>
            {hasPushAccess ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Push &amp; Write Access (Owner / Collaborator)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                Read-Only (Push Restricted)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Any team member added as a repository collaborator on GitHub can manage branches and push changes.
          </p>
        </div>
      )}

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
              disabled={!hasPushAccess}
              className="flex-1"
            />
            <Select value={baseBranch} onValueChange={setBaseBranch} disabled={!hasPushAccess}>
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
            <Button
              onClick={handleCreateBranch}
              disabled={creating || !newBranchName.trim() || !hasPushAccess}
              className="gap-1.5 shrink-0"
            >
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
            <Select value={mergeSource} onValueChange={setMergeSource} disabled={!hasPushAccess}>
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
            <Select value={mergeTarget} onValueChange={setMergeTarget} disabled={!hasPushAccess}>
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
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeSource || !mergeTarget || !hasPushAccess}
              className="gap-1.5 shrink-0"
            >
              {merging ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
              Merge
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="order-4" />

      {/* Branches table */}
      <div className="order-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">All Branches</h3>
          <span className="text-xs text-muted-foreground">{branches.length} branch(es)</span>
        </div>
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
                    {editingBranch === branch.name ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newBranchEditName}
                          onChange={(e) => setNewBranchEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleExecuteRename(branch.name);
                            if (e.key === 'Escape') cancelRename();
                          }}
                          className="h-8 text-xs font-mono max-w-[200px]"
                          autoFocus
                          disabled={isRenaming}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleExecuteRename(branch.name)}
                          disabled={isRenaming || !newBranchEditName.trim()}
                        >
                          {isRenaming ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={cancelRename}
                          disabled={isRenaming}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
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
                    )}
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
                      {/* Rename Branch Button */}
                      {hasPushAccess && editingBranch !== branch.name && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title="Rename branch"
                          onClick={() => startRename(branch.name)}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                      )}
                      {/* Delete Branch Button */}
                      {hasPushAccess && branch.name !== defaultBranch && branch.name !== selectedBranch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          title="Delete branch"
                          onClick={() => confirmDelete(branch.name)}
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5 text-destructive" />
              Delete Branch
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete branch{' '}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">
                {deletingBranch}
              </code>
              ? This action will permanently remove the branch from GitHub and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExecuteDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
