'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileDiff,
  FileText,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ai } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ToolOutputProps = {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  result: string;
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  downloadName: string;
};

function ToolOutput({
  eyebrow,
  title,
  icon,
  result,
  loading,
  emptyTitle,
  emptyDescription,
  onCopy,
  onDownload,
  copied,
  downloadName,
}: ToolOutputProps) {
  return (
    <section className="flex min-h-[27rem] flex-col overflow-hidden rounded-xl border border-border/80 bg-muted/20" data-testid={`output-panel-${downloadName.replace('.', '-')}`}>
      <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-background/65 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
            <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        {result && !loading ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onCopy}
              aria-label={copied ? 'Copied' : `Copy ${title}`}
              data-testid={`button-copy-${downloadName.replace('.', '-')}`}
            >
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onDownload}
              aria-label={`Download ${downloadName}`}
              data-testid={`button-download-${downloadName.replace('.', '-')}`}
            >
              <Download className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {loading ? (
          <div className="flex flex-1 flex-col justify-center gap-3" data-testid={`status-loading-${downloadName.replace('.', '-')}`}>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              Generating {downloadName === 'README.md' ? 'README' : 'message'}...
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 bg-background/55 p-4">
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : result ? (
          <pre
            className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-background/75 p-4 font-mono text-[13px] leading-6 text-foreground"
            data-testid={`text-generated-${downloadName.replace('.', '-')}`}
          >
            {result}
          </pre>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/35 px-6 text-center" data-testid={`status-empty-${downloadName.replace('.', '-')}`}>
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>
            <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{emptyDescription}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-[11px] text-muted-foreground">
        <span>{result ? 'Output ready to review' : 'No output yet'}</span>
        <span className="font-mono">{downloadName}</span>
      </div>
    </section>
  );
}

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AIToolsView() {
  return (
    <div className="mx-auto min-h-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-8 border-b border-border/70 pb-7">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Developer workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">AI tools</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Turn the work already in your repository into clear commit messages and useful documentation.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-7">
        <CommitMessageGenerator />
        <ReadmeGenerator />
      </div>
    </div>
  );
}

function CommitMessageGenerator() {
  const [diff, setDiff] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!diff.trim()) {
      toast.error('Please paste a diff.');
      return;
    }
    setLoading(true);
    setResult('');
    setCopied(false);
    try {
      const res = await ai.commitMessage(diff, context.trim() || undefined);
      setResult(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success('Commit message copied.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy the commit message.');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadText(result, 'commit-message.txt', 'text/plain');
    toast.success('Commit message downloaded.');
  };

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileDiff className="size-4 text-primary" />
              Commit message generator
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-xl">
              Give the generator a patch and optional context. Review the result before committing.
            </CardDescription>
          </div>
          <span className="hidden rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
            Git workflow
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ai-diff">Diff</Label>
              <span className="font-mono text-[10px] text-muted-foreground">{diff.length.toLocaleString()} chars</span>
            </div>
            <Textarea
              id="ai-diff"
              data-testid="input-commit-diff"
              placeholder="Paste git diff output here..."
              value={diff}
              onChange={(e) => setDiff(e.target.value)}
              rows={11}
              className="resize-y font-mono text-xs leading-5"
            />
            <p className="flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
              <Info className="size-3.5 shrink-0" />
              Include the complete patch when possible.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-context">Context <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="ai-context"
              data-testid="input-commit-context"
              placeholder="Issue, intent, or release context..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="resize-y text-sm"
            />
          </div>
          <Button type="button" onClick={handleGenerate} disabled={loading} className="w-full gap-1.5 sm:w-fit" data-testid="button-generate-commit">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? 'Generating...' : 'Generate message'}
          </Button>
        </div>

        <ToolOutput
          eyebrow="Generated output"
          title="Commit message"
          icon={<FileCode2 className="size-4" />}
          result={result}
          loading={loading}
          emptyTitle="Your message will appear here"
          emptyDescription="Paste a diff on the left, then generate a concise message grounded in the actual changes."
          onCopy={handleCopy}
          onDownload={handleDownload}
          copied={copied}
          downloadName="commit-message.txt"
        />
      </CardContent>
    </Card>
  );
}

function ReadmeGenerator() {
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [keyFiles, setKeyFiles] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!repoName.trim()) {
      toast.error('Repo name is required.');
      return;
    }
    setLoading(true);
    setResult('');
    setCopied(false);
    try {
      const files = keyFiles.trim() ? keyFiles.split(',').map((f) => f.trim()).filter(Boolean) : undefined;
      const res = await ai.readme(
        repoName.trim(),
        description.trim(),
        techStack.trim() || undefined,
        files,
      );
      setResult(res.readme);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success('README copied.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy the README.');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadText(result, 'README.md', 'text/markdown');
    toast.success('README downloaded.');
  };

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" />
              README generator
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-xl">
              Describe the project and its structure to create a practical starting point for your repository docs.
            </CardDescription>
          </div>
          <span className="hidden rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
            Markdown
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="readme-name">Repository name</Label>
              <Input
                id="readme-name"
                data-testid="input-readme-name"
                placeholder="my-project"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readme-stack">Tech stack <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="readme-stack"
                data-testid="input-readme-stack"
                placeholder="React, Node.js, PostgreSQL"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="readme-desc">Description</Label>
            <Textarea
              id="readme-desc"
              data-testid="input-readme-description"
              placeholder="What does this project do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-y text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="readme-files">Key files <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="readme-files"
              data-testid="input-readme-files"
              placeholder="package.json, src/main.ts, docker-compose.yml"
              value={keyFiles}
              onChange={(e) => setKeyFiles(e.target.value)}
            />
            <p className="text-[11px] leading-5 text-muted-foreground">Separate file paths with commas.</p>
          </div>
          <Button type="button" onClick={handleGenerate} disabled={loading} className="w-full gap-1.5 sm:w-fit" data-testid="button-generate-readme">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? 'Generating...' : 'Generate README'}
          </Button>
        </div>

        <ToolOutput
          eyebrow="Generated output"
          title="README.md"
          icon={<FileText className="size-4" />}
          result={result}
          loading={loading}
          emptyTitle="Your README will appear here"
          emptyDescription="Add a repository name and any useful project context, then generate a Markdown file you can download."
          onCopy={handleCopy}
          onDownload={handleDownload}
          copied={copied}
          downloadName="README.md"
        />
      </CardContent>
    </Card>
  );
}