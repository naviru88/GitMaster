'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Download,
  Pencil,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/appStore';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function ViewChangelog() {
  const { currentChangelog, setView, setEditedMarkdown } = useAppStore();

  if (!currentChangelog) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Changelog not found.
      </div>
    );
  }

  const markdown = currentChangelog.finalMarkdown || currentChangelog.draftMarkdown;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    toast.success('Markdown copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `changelog-${currentChangelog.version || currentChangelog.toRef || 'draft'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    setEditedMarkdown(currentChangelog.draftMarkdown);
    setView('edit-changelog');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView('project')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {currentChangelog.version || currentChangelog.toRef}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{format(new Date(currentChangelog.createdAt), 'MMM d, yyyy')}</span>
              <span>•</span>
              <span>{currentChangelog.fromRef} → {currentChangelog.toRef}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            {currentChangelog.voice === 'developer' ? (
              <><span className="text-xs">🛠️</span> Developer</>
            ) : (
              <><span className="text-xs">📣</span> Marketing</>
            )}
          </Badge>
          <Badge
            variant={currentChangelog.status === 'published' ? 'default' : 'secondary'}
            className={
              currentChangelog.status === 'published'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : ''
            }
          >
            {currentChangelog.status}
          </Badge>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        {currentChangelog.status === 'draft' && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="size-3.5" />
          Download .md
        </Button>
      </div>

      <Card className="py-4">
        <CardContent className="p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
