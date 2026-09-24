'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (release) {
      setTitle(release.title ?? '');
      setDescription(release.description ?? '');
      setPublished(release.published);
      setSubmitting(false);
    }
  }, [release]);

  const open = release !== null;
  const handleSubmit = async () => {
    if (!release) return;
    setSubmitting(true);
    try {
      await releasesApi.update(release.id, {
        title: title.trim() || null,
        description: description.trim() || null,
        published,
      });
      toast.success(`Updated ${release.version}`);
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
            The version string can't be changed here — delete and recreate to
            move a release to a different version.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
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
          <Button onClick={handleSubmit} disabled={submitting}>
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
