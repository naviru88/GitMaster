'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
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
import { releases as releasesApi, type Release } from '@/services/api';

interface EditReleaseDialogProps {
  release: Release | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function EditReleaseDialog({
  release,
  onOpenChange,
  onSaved,
}: EditReleaseDialogProps) {
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    if (release) {
      setVersion(release.version);
      setTitle(release.title ?? '');
      setDescription(release.description ?? '');
      setPublished(release.published);
      setSubmitting(false);
      setVersionError(null);
    }
  }, [release]);

  // Live validation of the version field (client-side mirror of server rules).
  useEffect(() => {
    if (!release) return;
    if (version.trim() === release.version) {
      setVersionError(null);
      return;
    }
    // Very light client-side validation; the server is the source of truth.
    const trimmed = version.trim();
    if (trimmed.length === 0) {
      setVersionError('Version cannot be empty');
      return;
    }
    if (!/^v?\d+(\.\d+)?(\.\d+)?$/.test(trimmed)) {
      setVersionError('Expected "v1", "v1.0", or "v1.0.1"');
      return;
    }
    setVersionError(null);
  }, [version, release]);

  const open = release !== null;
  const versionChanged = release !== null && version.trim() !== release.version;

  const handleSubmit = async () => {
    if (!release) return;
    if (versionError) {
      toast.error(versionError);
      return;
    }
    setSubmitting(true);
    try {
      const payload: Parameters<typeof releasesApi.update>[1] = {
        title: title.trim() || null,
        description: description.trim() || null,
        published,
      };
      if (versionChanged) {
        payload.version = version.trim();
      }
      await releasesApi.update(release.id, payload);
      toast.success(`Updated ${versionChanged ? version.trim() : release.version}`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update release.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {release?.version}</DialogTitle>
          <DialogDescription>
            Change the version label within the same level and parent, or
            update the title, description, and publish state.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-version">Version</Label>
            <Input
              id="edit-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              disabled={submitting}
              className={versionError ? 'border-destructive' : ''}
              placeholder="v1.0.1"
            />
            {versionError ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3" />
                {versionError}
              </p>
            ) : versionChanged ? (
              <p className="text-xs text-muted-foreground">
                The version can only be renamed within the same level and parent —
                the server will reject structural changes.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-title">
              Title <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-desc">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={5}
              maxLength={20000}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="edit-published" className="cursor-pointer">
              Published
            </Label>
            <Switch
              id="edit-published"
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
          <Button onClick={handleSubmit} disabled={submitting || !!versionError}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
