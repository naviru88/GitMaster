'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  FolderUp,
  Loader2,
  X,
  FileText,
  FileX2,
  FileCheck2,
  ShieldOff,
  ShieldCheck,
  Eye,
  EyeOff,
  UploadCloud,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { github } from '@/services/api';
import { filterByGitignore, DEFAULT_GITIGNORE_PATTERNS } from '@/lib/gitignore';
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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface PushFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FileItem {
  name: string;
  relativePath: string;
  size: number;
  file: File;
}

export default function PushFolderDialog({ open, onOpenChange, onSuccess }: PushFolderDialogProps) {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const filePath = useAppStore((s) => s.filePath);

  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const gitignoreFileRef = useRef<HTMLInputElement>(null);

  const [rawFiles, setRawFiles] = useState<FileItem[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Gitignore state
  const [gitignoreEnabled, setGitignoreEnabled] = useState(true);
  const [gitignoreSource, setGitignoreSource] = useState<'none' | 'auto' | 'manual'>('none');
  const [gitignoreContent, setGitignoreContent] = useState(DEFAULT_GITIGNORE_PATTERNS);
  const [showExcluded, setShowExcluded] = useState(false);
  const [forceIncludes, setForceIncludes] = useState<Set<string>>(new Set());

  // Derive relative paths (strip root folder name from directory picker)
  const getRelativePath = useCallback((item: FileItem) => {
    return item.relativePath.includes('/')
      ? item.relativePath.split('/').slice(1).join('/')
      : item.relativePath;
  }, []);

  // Apply gitignore filtering
  const { included, excluded } = useMemo(() => {
    if (!gitignoreEnabled || gitignoreSource === 'none' || rawFiles.length === 0) {
      return { included: rawFiles, excluded: [] as FileItem[] };
    }

    const allPaths = rawFiles.map((f) => getRelativePath(f));
    const { included: incPaths, excluded: excPaths } = filterByGitignore(allPaths, gitignoreContent);
    const incSet = new Set(incPaths);
    const excSet = new Set(excPaths);

    return {
      included: rawFiles.filter((f) => {
        const rp = getRelativePath(f);
        // If user force-included this file, treat as included
        if (forceIncludes.has(rp)) return true;
        return incSet.has(rp);
      }),
      excluded: rawFiles.filter((f) => {
        const rp = getRelativePath(f);
        // If user force-included this file, don't show as excluded
        if (forceIncludes.has(rp)) return false;
        return excSet.has(rp);
      }),
    };
  }, [rawFiles, gitignoreEnabled, gitignoreSource, gitignoreContent, forceIncludes, getRelativePath]);

  // Auto-detect .gitignore in selected files
  useEffect(() => {
    if (rawFiles.length === 0) return;
    const giFile = rawFiles.find(
      (f) => f.name === '.gitignore' && (f.relativePath === '.gitignore' || f.relativePath.endsWith('/.gitignore')),
    );
    if (giFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setGitignoreSource('auto');
        setGitignoreContent(content);
      };
      reader.readAsText(giFile.file);
    }
  }, [rawFiles]);

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    const items: FileItem[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      items.push({
        name: f.name,
        relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        size: f.size,
        file: f,
      });
    }
    setRawFiles(items);
    setForceIncludes(new Set());
    if (!commitMessage) {
      setCommitMessage(`Push ${items.length} files from local folder`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    const items: FileItem[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      items.push({
        name: f.name,
        relativePath: f.name,
        size: f.size,
        file: f,
      });
    }
    setRawFiles(items);
    setForceIncludes(new Set());
    if (!commitMessage) {
      setCommitMessage(`Add ${items.length} file(s)`);
    }
  };

  const handleGitignoreFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setGitignoreSource('manual');
      setGitignoreContent(content);
      toast.success(`Loaded .gitignore from ${file.name}`);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const toggleForceInclude = (path: string) => {
    setForceIncludes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const removeFile = (index: number) => {
    setRawFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePush = async () => {
    if (!selectedAccountId || !selectedRepo || included.length === 0) return;
    const msg = commitMessage.trim() || 'Push files';
    const branch = selectedBranch || selectedRepo.default_branch;

    setPushing(true);
    setProgress(0);

    try {
      const fileData: Array<{ path: string; content: string; isBase64: boolean }> = [];
      for (let i = 0; i < included.length; i++) {
        const f = included[i];
        const buffer = await f.file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const relativePath = getRelativePath(f);
        fileData.push({ path: relativePath, content: base64, isBase64: true });
        setProgress(Math.round(((i + 1) / included.length) * 70));
      }

      const result = await github.push.batch(
        selectedAccountId,
        selectedRepo.owner.login,
        selectedRepo.name,
        branch,
        fileData,
        msg,
        filePath || undefined,
      );

      setProgress(100);
      const excludedNote = excluded.length > 0 ? ` (${excluded.length} file(s) excluded by .gitignore)` : '';
      toast.success(`Pushed ${result.filesCommitted} file(s) in commit ${result.sha.slice(0, 7)}${excludedNote}`);
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Push failed.');
    } finally {
      setPushing(false);
      setProgress(0);
    }
  };

  const resetState = () => {
    setRawFiles([]);
    setCommitMessage('');
    setProgress(0);
    setGitignoreSource('none');
    setGitignoreContent(DEFAULT_GITIGNORE_PATTERNS);
    setForceIncludes(new Set());
    setShowExcluded(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = included.reduce((sum, f) => sum + f.size, 0);
  const excludedSize = excluded.reduce((sum, f) => sum + f.size, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FolderUp className="size-5" />
            Push to {selectedRepo?.name}
          </DialogTitle>
          <DialogDescription>
            Upload files from your local machine. All files will be committed in a single operation.
            <br />
            <span className="text-xs text-muted-foreground">
              Branch: <code className="rounded bg-muted px-1 font-mono">{selectedBranch || selectedRepo?.default_branch}</code>
              {filePath && (
                <span>
                  {' '}&middot; Path: <code className="rounded bg-muted px-1 font-mono">{filePath}</code>
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          {/* File selection buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => folderRef.current?.click()}
              disabled={pushing}
            >
              <FolderUp className="size-4" />
              Select Folder
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => filesRef.current?.click()}
              disabled={pushing}
            >
              <Upload className="size-4" />
              Select Files
            </Button>
            <input
              ref={folderRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              className="hidden"
              onChange={handleFolderSelect}
            />
            <input
              ref={filesRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* .gitignore section */}
          {rawFiles.length > 0 && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    {gitignoreEnabled ? (
                      <ShieldCheck className="size-4 text-green-600" />
                    ) : (
                      <ShieldOff className="size-4 text-muted-foreground" />
                    )}
                    .gitignore
                  </Label>
                  {gitignoreSource === 'auto' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      auto-detected
                    </Badge>
                  )}
                  {gitignoreSource === 'manual' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      uploaded
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => gitignoreFileRef.current?.click()}
                        disabled={pushing}
                      >
                        <UploadCloud className="size-3" />
                        Load File
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload a .gitignore file from your machine</TooltipContent>
                  </Tooltip>
                  <Switch
                    checked={gitignoreEnabled}
                    onCheckedChange={setGitignoreEnabled}
                    disabled={pushing}
                  />
                </div>
              </div>

              {gitignoreEnabled && gitignoreSource !== 'none' && (
                <>
                  {excluded.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <FileX2 className="size-3.5 text-orange-500" />
                      <span className="text-orange-600 font-medium">
                        {excluded.length} file(s) excluded
                      </span>
                      <span className="text-muted-foreground">
                        ({formatSize(excludedSize)} saved)
                      </span>
                      <button
                        className="ml-auto text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        onClick={() => setShowExcluded((v) => !v)}
                      >
                        {showExcluded ? (
                          <>
                            <EyeOff className="size-3" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" /> Show
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Excluded files list (collapsible) */}
                  {showExcluded && excluded.length > 0 && (
                    <ScrollArea className="max-h-28 mb-2">
                      <div className="divide-y rounded border bg-destructive/5">
                        {excluded.map((f, i) => {
                          const rp = getRelativePath(f);
                          const isForced = forceIncludes.has(rp);
                          return (
                            <div
                              key={`exc-${i}`}
                              className={`flex items-center gap-2 px-3 py-1 text-xs group ${isForced ? 'opacity-50 line-through' : ''}`}
                            >
                              <Checkbox
                                checked={isForced}
                                onCheckedChange={() => toggleForceInclude(rp)}
                                className="size-3.5"
                              />
                              <FileText className="size-3 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate font-mono" title={rp}>
                                {rp}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {formatSize(f.size)}
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => toggleForceInclude(rp)}
                                    className="text-muted-foreground hover:text-green-600 transition-colors"
                                    title={isForced ? 'Re-exclude this file' : 'Include this file despite .gitignore'}
                                  >
                                    {isForced ? (
                                      <ShieldOff className="size-3" />
                                    ) : (
                                      <ShieldCheck className="size-3" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isForced ? 'Re-exclude this file' : 'Force-include this file'}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Editable gitignore content */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground justify-start gap-1.5"
                      >
                        Edit .gitignore rules
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <textarea
                        className="mt-1 w-full min-h-[80px] max-h-[200px] rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                        value={gitignoreContent}
                        onChange={(e) => {
                          setGitignoreContent(e.target.value);
                          if (gitignoreSource === 'auto') setGitignoreSource('manual');
                        }}
                        disabled={pushing}
                        placeholder="# Add gitignore patterns here..."
                        spellCheck={false}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {gitignoreEnabled && gitignoreSource === 'none' && (
                <p className="text-xs text-muted-foreground">
                  Using default rules (node_modules/, .git/, .DS_Store, Thumbs.db, *.log).{' '}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => gitignoreFileRef.current?.click()}
                  >
                    Upload a .gitignore file
                  </button>{' '}
                  to use your project rules.
                </p>
              )}

              {!gitignoreEnabled && (
                <p className="text-xs text-muted-foreground">
                  .gitignore filtering is disabled. All selected files will be pushed.
                </p>
              )}

              <input
                ref={gitignoreFileRef}
                type="file"
                accept=".gitignore"
                className="hidden"
                onChange={handleGitignoreFileUpload}
              />
            </div>
          )}

          {/* Included file list */}
          {included.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="size-3.5 text-green-600" />
                  {included.length} file(s) to push
                  {excluded.length > 0 && gitignoreEnabled && (
                    <span className="text-orange-500">
                      {' '}({excluded.length} excluded)
                    </span>
                  )}
                </span>
                <span>{formatSize(totalSize)}</span>
              </div>
              <ScrollArea className="max-h-48">
                <div className="divide-y">
                  {included.map((f, i) => (
                    <div key={`inc-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm group">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate font-mono text-xs" title={getRelativePath(f)}>
                        {getRelativePath(f)}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                      {!pushing && (
                        <button
                          onClick={() => removeFile(rawFiles.indexOf(f))}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* No files after filtering warning */}
          {rawFiles.length > 0 && included.length === 0 && (
            <div className="border rounded-lg p-4 text-center">
              <FileX2 className="size-8 mx-auto text-orange-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                All {rawFiles.length} selected file(s) match .gitignore rules.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Show excluded files to force-include specific ones, or disable .gitignore filtering.
              </p>
            </div>
          )}

          {/* Commit message */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="push-msg">Commit message</Label>
            <Input
              id="push-msg"
              placeholder="e.g. Add new feature files"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={pushing}
            />
          </div>

          {/* Progress */}
          {pushing && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  {progress < 70 ? 'Reading files...' : 'Committing to GitHub...'}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pushing}>
            Cancel
          </Button>
          <Button
            onClick={handlePush}
            disabled={pushing || included.length === 0 || !commitMessage.trim()}
            className="gap-1.5"
          >
            {pushing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {pushing ? 'Pushing...' : `Push ${included.length} File(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
