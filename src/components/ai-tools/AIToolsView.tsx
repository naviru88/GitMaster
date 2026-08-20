'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Copy, Download, Loader2 } from 'lucide-react';
import { ai } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AIToolsView() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Tools</h1>
        <p className="text-muted-foreground mt-1">Leverage AI to generate commit messages and READMEs.</p>
      </div>
      <CommitMessageGenerator />
      <ReadmeGenerator />
    </div>
  );
}

function CommitMessageGenerator() {
  const [diff, setDiff] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!diff.trim()) {
      toast.error('Please paste a diff.');
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const res = await ai.commitMessage(diff, context.trim() || undefined);
      setResult(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          Commit Message Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-diff">Diff</Label>
          <Textarea
            id="ai-diff"
            placeholder="Paste your diff here..."
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-context">Context (optional)</Label>
          <Textarea
            id="ai-context"
            placeholder="Any additional context about the changes..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
          />
        </div>
        <Button onClick={handleGenerate} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate
        </Button>
        {result && (
          <div className="relative rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-2">
              <Label>Result</Label>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleCopy}>
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap font-mono">{result}</p>
          </div>
        )}
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

  const handleGenerate = async () => {
    if (!repoName.trim()) {
      toast.error('Repo name is required.');
      return;
    }
    setLoading(true);
    setResult('');
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

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          README Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="readme-name">Repo Name</Label>
            <Input
              id="readme-name"
              placeholder="my-awesome-repo"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="readme-stack">Tech Stack</Label>
            <Input
              id="readme-stack"
              placeholder="React, Node.js, PostgreSQL..."
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="readme-desc">Description</Label>
          <Textarea
            id="readme-desc"
            placeholder="What does this project do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="readme-files">Key Files (comma-separated)</Label>
          <Input
            id="readme-files"
            placeholder="package.json, tsconfig.json, docker-compose.yml"
            value={keyFiles}
            onChange={(e) => setKeyFiles(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate
        </Button>
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Generated README</Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
                  <Copy className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={handleDownload}>
                  <Download className="size-3.5" />
                </Button>
              </div>
            </div>
            <pre className="rounded-lg border bg-muted/30 p-4 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96">
              {result}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
