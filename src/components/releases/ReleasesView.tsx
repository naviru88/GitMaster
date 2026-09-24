'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Download, ExternalLink, Package } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { releases as releasesApi, type Release } from '@/services/api';
import ReleaseNode from './ReleaseNode';
import CreateReleaseDialog from './CreateReleaseDialog';
import EditReleaseDialog from './EditReleaseDialog';

// Flatten a nested tree into a list of versions for duplicate checks
function collectVersions(tree: Release[]): string[] {
  const out: string[] = [];
  const walk = (nodes: Release[]) => {
    for (const n of nodes) {
      out.push(n.version);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export default function ReleasesView() {
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [tree, setTree] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [deleting, setDeleting] = useState<Release | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Resolve project ID when the repo changes
  useEffect(() => {
    if (!selectedRepo || !selectedAccountId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const project = await releasesApi.resolveProject({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          githubUrl: selectedRepo.html_url,
          name: selectedRepo.name,
        });
        if (!cancelled) setProjectId(project.id);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to resolve project.';
          setError(msg);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, selectedAccountId]);

  // Fetch the release tree whenever projectId is known
  const fetchTree = useCallback(async (pid: string) => {
    try {
      setError(null);
      const result = await releasesApi.list(pid, { includeUnpublished: true });
      setTree(result.tree);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load releases.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      fetchTree(projectId);
    }
  }, [projectId, fetchTree]);

  const refresh = useCallback(() => {
    if (projectId) fetchTree(projectId);
  }, [projectId, fetchTree]);

  const existingVersions = useMemo(() => collectVersions(tree), [tree]);
  const totalCount = existingVersions.length;

  // Actions
  const handleTogglePublished = useCallback(
    async (node: Release) => {
      try {
        await releasesApi.update(node.id, { published: !node.published });
        toast.success(node.published ? `Unpublished ${node.version}` : `Published ${node.version}`);
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update release.');
      }
    },
    [refresh],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      const result = await releasesApi.delete(deleting.id);
      toast.success(
        `Deleted ${result.version}` +
          (result.cascadedChildren > 0
            ? ` (+${result.cascadedChildren} child release${result.cascadedChildren === 1 ? '' : 's'})`
            : '') +
          (result.cascadedCommits > 0
            ? ` and ${result.cascadedCommits} commit${result.cascadedCommits === 1 ? '' : 's'}`
            : ''),
      );
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete release.');
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleting, refresh]);

  const handleDownloadHtml = useCallback(() => {
    if (!projectId) return;
    const url = releasesApi.exportUrl(projectId, {
      format: 'html',
      disposition: 'attachment',
    });
    window.open(url, '_blank');
  }, [projectId]);

  const handlePreviewHtml = useCallback(() => {
    if (!projectId) return;
    const url = releasesApi.exportUrl(projectId, {
      format: 'html',
      disposition: 'inline',
    });
    window.open(url, '_blank');
  }, [projectId]);

  // Render
  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Package className="size-8 text-muted-foreground" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => projectId && fetchTree(projectId)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No project resolved.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-muted-foreground" />
          <h3 className="text-base font-medium">
            Releases
            {totalCount > 0 && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                ({totalCount})
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewHtml}
                className="gap-1.5"
              >
                <ExternalLink className="size-3.5" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHtml}
                className="gap-1.5"
              >
                <Download className="size-3.5" />
                Download
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            New Release
          </Button>
        </div>
      </div>

      {/* Tree or empty state */}
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Package className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No releases yet</p>
          <p className="text-xs text-muted-foreground">
            Start by creating a major version like <code className="rounded bg-muted px-1">v1</code>.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
            className="mt-2 gap-1.5"
          >
            <Plus className="size-3.5" />
            Create First Release
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[70vh]">
          <div className="flex flex-col gap-1 pr-2">
            {tree.map((node) => (
              <ReleaseNode
                key={node.id}
                node={node}
                depth={0}
                onEdit={setEditing}
                onDelete={setDeleting}
                onTogglePublished={handleTogglePublished}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create dialog */}
      <CreateReleaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        existingVersions={existingVersions}
        onCreated={refresh}
      />

      {/* Edit dialog — created separately below */}
      <EditReleaseDialog
        release={editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={refresh}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && !deleteSubmitting && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this release
              {deleting && deleting.children.length > 0 && (
                <> and its {deleting.children.length} child release{deleting.children.length === 1 ? '' : 's'}</>
              )}
              {deleting && deleting.commits.length > 0 && (
                <> along with {deleting.commits.length} attached commit{deleting.commits.length === 1 ? '' : 's'}</>
              )}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
