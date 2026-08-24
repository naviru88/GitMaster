'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Download,
  Save,
  Eye,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { useAppStore } from '@/store/appStore';
import { updateChangelog } from '@/services/api';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function EditChangelog() {
  const {
    currentChangelog,
    editedMarkdown,
    setEditedMarkdown,
    setCurrentChangelog,
    setView,
  } = useAppStore();

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [activePanel, setActivePanel] = useState<'edit' | 'preview'>('edit');

  const handleSave = useCallback(async () => {
    if (!currentChangelog) return;
    try {
      setSaving(true);
      const updated = await updateChangelog(currentChangelog.id, {
        draftMarkdown: editedMarkdown,
      });
      setCurrentChangelog(updated);
      toast.success('Changelog saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [currentChangelog, editedMarkdown, setCurrentChangelog]);

  const handlePublish = async () => {
    if (!currentChangelog) return;
    try {
      setPublishing(true);
      const updated = await updateChangelog(currentChangelog.id, {
        draftMarkdown: editedMarkdown,
        status: 'published',
      });
      setCurrentChangelog(updated);
      toast.success('Changelog published!');
      setView('view-changelog');
    } catch {
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
      setShowPublishDialog(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedMarkdown);
    toast.success('Markdown copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([editedMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `changelog-${currentChangelog?.version || currentChangelog?.toRef || 'draft'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentChangelog) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Changelog not found.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setView('project')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">
            Edit: {currentChangelog.version || currentChangelog.toRef}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentChangelog.fromRef} → {currentChangelog.toRef}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5"
        >
          <Save className="size-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="gap-1.5"
        >
          <Download className="size-3.5" />
          Download .md
        </Button>
        <Separator orientation="vertical" className="h-6" />
        {currentChangelog.status === 'draft' && (
          <Button
            size="sm"
            onClick={() => setShowPublishDialog(true)}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Sparkles className="size-3.5" />
            Publish
          </Button>
        )}
      </div>

      {/* Mobile toggle */}
      <div className="flex gap-2 lg:hidden">
        <Button
          variant={activePanel === 'edit' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActivePanel('edit')}
          className="gap-1.5 flex-1"
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          variant={activePanel === 'preview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActivePanel('preview')}
          className="gap-1.5 flex-1"
        >
          <Eye className="size-3.5" />
          Preview
        </Button>
      </div>

      {/* Split Pane */}
      <div className="grid min-h-[500px] grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`space-y-2 ${activePanel === 'preview' ? 'hidden lg:block' : ''}`}>
          <Label className="text-sm font-medium text-muted-foreground">Markdown Editor</Label>
          <Textarea
            value={editedMarkdown}
            onChange={(e) => setEditedMarkdown(e.target.value)}
            onBlur={handleSave}
            className="min-h-[450px] resize-none font-mono text-sm"
            placeholder="Changelog content..."
          />
        </div>
        <div className={`space-y-2 ${activePanel === 'edit' ? 'hidden lg:block' : ''}`}>
          <Label className="text-sm font-medium text-muted-foreground">Preview</Label>
          <Card className="min-h-[450px] overflow-auto p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{editedMarkdown}</ReactMarkdown>
            </div>
          </Card>
        </div>
      </div>

      {/* Publish Confirmation */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Changelog</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the changelog as published. It will appear in the Running Changelog view.
              You can still edit it after publishing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={publishing}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
