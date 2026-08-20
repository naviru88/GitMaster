'use client';

import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';
import { ArrowLeft, Save, Download, Trash2, Sparkles, Loader2, FileText } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github, ai } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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

export default function FileEditor() {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const openedFile = useAppStore((s) => s.openedFile);
  const setOpenedFile = useAppStore((s) => s.setOpenedFile);
  const setView = useAppStore((s) => s.setView);
  const setFileContents = useAppStore((s) => s.setFileContents);
  const filePath = useAppStore((s) => s.filePath);
  const setFilePath = useAppStore((s) => s.setFilePath);

  const [content, setContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (openedFile) {
      setContent(openedFile.decoded);
    }
  }, [openedFile]);

  const handleBack = () => {
    setView('repo-detail');
    setOpenedFile(null);
  };

  const handleSave = async () => {
    if (!selectedAccountId || !selectedRepo || !openedFile) return;
    const msg = commitMessage.trim() || `Update ${openedFile.content.name}`;
    setSaving(true);
    try {
      const result = await github.contents.saveFile(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        openedFile.content.path,
        content,
        msg,
        openedFile.content.sha || undefined,
        selectedBranch || undefined,
      );
      setOpenedFile({
        content: result.content,
        decoded: content,
      });
      toast.success('File saved!');
      setCommitMessage('');
      // Refresh file list
      const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
      const contents = await github.contents.list(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        parentPath,
        selectedBranch || undefined,
      );
      setFileContents(contents);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save file.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!openedFile) return;
    const original = openedFile.decoded;
    const current = content;
    if (original === current) {
      toast.info('No changes to generate a message for.');
      return;
    }
    setGenerating(true);
    try {
      const diff = `--- a/${openedFile.content.name}\n+++ b/${openedFile.content.name}\n@@ -1,${original.split('\n').length} +1,${current.split('\n').length} @@\n${current}`;
      const result = await ai.commitMessage(diff, `File: ${openedFile.content.path}`);
      setCommitMessage(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate commit message.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!openedFile) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = openedFile.content.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!selectedAccountId || !selectedRepo || !openedFile) return;
    const msg = `Delete ${openedFile.content.path}`;
    setDeleting(true);
    try {
      await github.contents.deleteFile(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        openedFile.content.path,
        msg,
        openedFile.content.sha,
        selectedBranch || undefined,
      );
      toast.success('File deleted.');
      setDeleteOpen(false);
      setOpenedFile(null);
      // Refresh file list
      const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
      const contents = await github.contents.list(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        parentPath,
        selectedBranch || undefined,
      );
      setFileContents(contents);
      setView('repo-detail');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file.');
    } finally {
      setDeleting(false);
    }
  };

  if (!openedFile) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <FileText className="size-5" />
        No file opened.
      </div>
    );
  }

  const isMarkdown = openedFile.content.name.endsWith('.md') || openedFile.content.name.endsWith('.mdx');

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm truncate">{openedFile.content.path}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs font-mono">{selectedBranch}</Badge>
          </div>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={isMarkdown ? 50 : 100} minSize={30}>
            <div className="h-full">
              <textarea
                className="h-full w-full resize-none p-4 font-mono text-sm bg-white outline-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
            </div>
          </ResizablePanel>
          {isMarkdown && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full overflow-auto p-4 bg-white">
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{content}</Markdown>
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Bottom toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 p-3 border rounded-lg bg-muted/30">
        <Input
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerateMessage} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Generate
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="size-3.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <code className="rounded bg-muted px-1 font-mono text-xs">{openedFile.content.path}</code> from the repository. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
