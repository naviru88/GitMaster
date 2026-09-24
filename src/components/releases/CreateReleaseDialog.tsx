'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { releases } from '@/services/api';
import { parseVersion, VersionError } from '@/lib/releases/version';

interface CreateReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Existing version strings so we can validate duplicates up front. */
  existingVersions: string[];
  /** Called after a successful create. */
  onCreated: () => void;
}

interface ParsedInfo {
  ok: true;
  version: string;
  level: 'MAJOR' | 'MINOR' | 'PATCH';
  parentVersion: string | null;
}

interface ParseError {
  ok: false;
  message: string;
}

type ParseState = ParsedInfo | ParseError | null;

export default function CreateReleaseDialog({
  open,
  onOpenChange,
  projectId,
  existingVersions,
  onCreated,
}: CreateReleaseDialogProps) {
  const [versionInput, setVersionInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever the dialog opens fresh
  useEffect(() => {
    if (open) {
      setVersionInput('');
      setTitle('');
      setDescription('');
      setPublished(false);
      setSubmitting(false);
    }
  }, [open]);

  // Live-validate the version as the user types
  const parsed: ParseState = useMemo(() => {
    const trimmed = versionInput.trim();
    if (trimmed.length === 0) return null;

    try {
      const p = parseVersion(trimmed);
      return {
        ok: true,
        version: p.version,
        level: p.level,
        parentVersion: p.parentVersion,
      };
    } catch (e) {
      if (e instanceof VersionError) {
        return { ok: false, message: e.message };
      }
      return { ok: false, message: 'Invalid version' };
    }
  }, [versionInput]);

  // Additional warnings from cross-referencing existing versions
  const warnings: string[] = useMemo(() => {
    if (!parsed || !parsed.ok) return [];
    const out: string[] = [];

    if (existingVersions.includes(parsed.version)) {
      out.push(`Version ${parsed.version} already exists in this project.`);
    }

    if (parsed.parentVersion !== null) {
      const parentExists = existingVersions.includes(parsed.parentVersion);
      if (!parentExists) {
        out.push(
          `Parent ${parsed.parentVersion} doesn't exist yet — create it first.`,
        );
      }
    }

    return out;
  }, [parsed, existingVersions]);

  const canSubmit =
    !submitting &&
    parsed !== null &&
    parsed.ok === true &&
    warnings.length === 0;

  const handleSubmit = async () => {
    if (!canSubmit || !parsed || !parsed.ok) return;
    setSubmitting(true);
    try {
      await releases.create(projectId, {
        version: parsed.version,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        published,
      });
      toast.success(`Created ${parsed.version}`);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create release.');
    } finally {
      setSubmitting(false);
    }
  };

  // Level badge styling — matches the HTML generator's color scheme
  const levelBadge = parsed?.ok ? (
    <Badge
      variant="secondary"
      className={
        parsed.level === 'MAJOR'
          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
          : parsed.level === 'MINOR'
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-green-500/15 text-green-600 dark:text-green-400'
      }
    >
      {parsed.level}
    </Badge>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5" />
            New Release
          </DialogTitle>
          <DialogDescription>
            Add a version node to the release tree. The parent is determined
            automatically from the version string.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Version */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="release-version">Version</Label>
            <div className="flex items-center gap-2">
              <Input
                id="release-version"
                placeholder="v1.0.1"
                value={versionInput}
                onChange={(e) => setVersionInput(e.target.value)}
                autoFocus
                disabled={submitting}
                className="font-mono"
              />
              {levelBadge}
            </div>

            {parsed && !parsed.ok && (
              <p className="text-xs text-destructive">{parsed.message}</p>
            )}
            {parsed && parsed.ok && parsed.parentVersion === null && (
              <p className="text-xs text-muted-foreground">
                Root release (no parent)
              </p>
            )}
            {parsed && parsed.ok && parsed.parentVersion !== null && (
              <p className="text-xs text-muted-foreground">
                Parent: <code className="rounded bg-muted px-1">{parsed.parentVersion}</code>
              </p>
            )}
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ {w}
              </p>
            ))}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="release-title">
              Title <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="release-title"
              placeholder="e.g. Auth Overhaul"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="release-desc">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="release-desc"
              placeholder="What changed in this release?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={4}
              maxLength={20000}
            />
          </div>

          {/* Published toggle */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="release-published" className="cursor-pointer">
                Publish immediately
              </Label>
              <span className="text-xs text-muted-foreground">
                Drafts are only visible to you.
              </span>
            </div>
            <Switch
              id="release-published"
              checked={published}
              onCheckedChange={setPublished}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Release'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
