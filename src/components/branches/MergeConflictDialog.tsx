'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  GitMerge,
  Loader2,
  AlertTriangle,
  Check,
  FileWarning,
  ExternalLink,
  CircleAlert,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { github } from '@/services/api';
import type { MergeConflictCheckResult, MergeConflictFile } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MergeConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  owner: string;
  repo: string;
  /** Target branch — where the merge commit lands. */
  base: string;
  /** Source branch — the one being merged in. */
  head: string;
  onResolved: () => void;
}

/** A conflict the app genuinely cannot offer in-app resolution for fall back to "resolve via PR or local git" instead of an editor. */
function isUnresolvable(c: MergeConflictFile): boolean {
  return c.isBinary || c.tooLarge;
}

const KIND_LABEL: Record<MergeConflictFile['kind'], string> = {
  'both-modified': 'Both branches edited this file differently',
  'modified-deleted': `Edited on base, deleted on head`,
  'deleted-modified': `Deleted on base, edited on head`,
  'both-added': 'Both branches added this file independently',
};

export default function MergeConflictDialog({
  open, onOpenChange, accountId, owner, repo, base, head, onResolved,
}: MergeConflictDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [check, setCheck] = useState<MergeConflictCheckResult | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, string | null>>(new Map());
  const [activePath, setActivePath] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setCheck(null);
    setResolutions(new Map());
    github.merge.checkConflicts(accountId, owner, repo, base, head)
      .then((result) => {
        if (cancelled) return;
        setCheck(result);
        // Pre-fill each resolvable conflict's editor with head's version
        const initial = new Map<string, string | null>();
        for (const c of result.conflicts) {
          if (!isUnresolvable(c)) {
            initial.set(c.path, c.headContent ?? c.baseContent ?? '');
          }
        }
        setResolutions(initial);
        setActivePath(result.conflicts[0]?.path || '');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to check for conflicts.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, accountId, owner, repo, base, head]);

  const resolvableConflicts = useMemo(
    () => check?.conflicts.filter((c) => !isUnresolvable(c)) ?? [],
    [check],
  );
  const blockedConflicts = useMemo(
    () => check?.conflicts.filter(isUnresolvable) ?? [],
    [check],
  );
  const allResolvableFilled = resolvableConflicts.every((c) => resolutions.has(c.path));
  const canSubmit = !loading && !!check && blockedConflicts.length === 0 && allResolvableFilled && !submitting;

  const handleSubmit = async () => {
    if (!check) return;
    setSubmitting(true);
    const toastId = toast.loading('Creating merge commit…');
    try {
      const payload = resolvableConflicts.map((c) => ({
        path: c.path,
        content: resolutions.get(c.path) ?? null,
      }));
      const result = await github.merge.resolveConflicts(
        accountId, owner, repo, base, head,
        check.autoApplyPaths, payload,
        `Merge ${head} into ${base}`,
      );
      toast.success(`Merged ${head} into ${base}`, {
        id: toastId,
        description: `Commit ${result.sha.slice(0, 7)} · ${result.filesResolved} resolved, ${result.filesAutoApplied} auto-applied`,
      });
      onOpenChange(false);
      onResolved();
    } catch (err) {
      toast.error('Could not create the merge commit', {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unknown error — please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeConflict = check?.conflicts.find((c) => c.path === activePath) || null;

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-5" />
            Resolve conflicts — {head} → {base}
          </DialogTitle>
          <DialogDescription>
            GitHub couldn&apos;t auto-merge these branches. Review each conflicting file below and choose what the merged result should look like.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Comparing {base} and {head}…
          </div>
        )}

        {!loading && loadError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Couldn&apos;t check for conflicts</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!loading && !loadError && check && (
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            {!check.hasConflicts && (
              <Alert>
                <Check className="size-4" />
                <AlertTitle>No content conflicts found</AlertTitle>
                <AlertDescription>
                  {check.autoApplyPaths.length > 0
                    ? `${check.autoApplyPaths.length} file(s) from ${head} will be applied automatically.`
                    : 'Nothing to change — this will still create a merge commit recording the merge.'}
                </AlertDescription>
              </Alert>
            )}

            {blockedConflicts.length > 0 && (
              <Alert variant="destructive">
                <FileWarning className="size-4" />
                <AlertTitle>{blockedConflicts.length} file(s) can&apos;t be resolved here</AlertTitle>
                <AlertDescription>
                  <p className="mb-1.5">Binary content or files too large to edit safely in-app:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {blockedConflicts.map((c) => (
                      <li key={c.path} className="font-mono text-xs">{c.path}</li>
                    ))}
                  </ul>
                  <p className="mt-1.5">
                    Resolve these via a <span className="inline-flex items-center gap-0.5">Pull Request on GitHub <ExternalLink className="size-3" /></span> or locally with <code className="rounded bg-muted px-1">git merge</code>, then come back to merge the rest — or resolve those first and retry.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {check.hasConflicts && resolvableConflicts.length > 0 && (
              <Tabs value={activePath} onValueChange={setActivePath} className="flex-1 min-h-0 flex flex-col">
                <ScrollArea className="w-full">
                  <TabsList className="w-max">
                    {resolvableConflicts.map((c) => (
                      <TabsTrigger key={c.path} value={c.path} className="font-mono text-xs gap-1.5">
                        {c.path.split('/').pop()}
                        {resolutions.get(c.path) !== undefined && (
                          <Check className="size-3 text-green-600" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>

                {resolvableConflicts.map((c) => {
                  const currentValue = resolutions.get(c.path);
                  const willDelete = currentValue === null;
                  return (
                  <TabsContent key={c.path} value={c.path} className="flex-1 min-h-0 flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CircleAlert className="size-3.5 text-orange-500 shrink-0" />
                      <span className="font-mono">{c.path}</span>
                      <Badge variant="secondary" className="text-[10px]">{KIND_LABEL[c.kind]}</Badge>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      <Button
                        type="button" size="sm" variant="outline" className="h-6 text-xs"
                        disabled={c.baseContent === null}
                        onClick={() => setResolutions((prev) => new Map(prev).set(c.path, c.baseContent ?? ''))}
                      >
                        Use {base} version
                      </Button>
                      <Button
                        type="button" size="sm" variant="outline" className="h-6 text-xs"
                        disabled={c.headContent === null}
                        onClick={() => setResolutions((prev) => new Map(prev).set(c.path, c.headContent ?? ''))}
                      >
                        Use {head} version
                      </Button>
                      {c.ancestorContent !== null && (
                        <Button
                          type="button" size="sm" variant="outline" className="h-6 text-xs"
                          onClick={() => setResolutions((prev) => new Map(prev).set(c.path, c.ancestorContent ?? ''))}
                        >
                          Use common ancestor
                        </Button>
                      )}
                      <Button
                        type="button" size="sm" variant={willDelete ? 'destructive' : 'outline'} className="h-6 text-xs gap-1"
                        onClick={() => setResolutions((prev) => new Map(prev).set(c.path, null))}
                      >
                        <Trash2 className="size-3" />
                        Delete file
                      </Button>
                      {c.baseContent === null && (
                        <span className="text-xs text-muted-foreground self-center">Deleted on {base}</span>
                      )}
                      {c.headContent === null && (
                        <span className="text-xs text-muted-foreground self-center">Deleted on {head}</span>
                      )}
                    </div>

                    {willDelete ? (
                      <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
                        <Trash2 className="size-5" />
                        <span>This file will be deleted in the merge result.</span>
                        <Button
                          type="button" size="sm" variant="ghost" className="h-6 text-xs gap-1"
                          onClick={() => setResolutions((prev) => new Map(prev).set(c.path, c.headContent ?? c.baseContent ?? ''))}
                        >
                          <RotateCcw className="size-3" />
                          Keep the file instead
                        </Button>
                      </div>
                    ) : (
                      <Textarea
                        value={currentValue ?? ''}
                        onChange={(e) => setResolutions((prev) => new Map(prev).set(c.path, e.target.value))}
                        className="flex-1 min-h-[220px] font-mono text-xs resize-none"
                        spellCheck={false}
                        placeholder="Edit the resolved content for this file…"
                      />
                    )}
                  </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <GitMerge className="size-3.5" />}
            {submitting ? 'Merging…' : 'Commit Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
