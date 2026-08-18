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
  Check,
  ChevronRight,
  ArrowLeft,
  HardDrive,
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

/** Convert ArrayBuffer to base64 without stack overflow (works for large files) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Yield to the event loop so the UI doesn't freeze */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type Step = 'message' | 'files' | 'review';

export default function PushFolderDialog({ open, onOpenChange, onSuccess }: PushFolderDialogProps) {
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const selectedBranch = useAppStore((s) => s.selectedBranch);
  const filePath = useAppStore((s) => s.filePath);

  const gitignoreFileRef = useRef<HTMLInputElement>(null);

  // Wizard step
  const [step, setStep] = useState<Step>('message');

  // File state
  const [rawFiles, setRawFiles] = useState<FileItem[]>([]);
  const [commitMessage, setCommitMessage] = useState('');

  // Incremental processing state
  const [processingQueue, setProcessingQueue] = useState(0);
  const [processingDone, setProcessingDone] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const fileCacheRef = useRef<Map<string, string>>(new Map()); // path -> base64
  // Counter to force re-render when cache is updated
  const [cacheVersion, setCacheVersion] = useState(0);
  // ID to cancel stale processing runs
  const processingIdRef = useRef(0);

  // Push state
  const [pushing, setPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(0);

  // Gitignore state
  const [gitignoreEnabled, setGitignoreEnabled] = useState(true);
  const [gitignoreSource, setGitignoreSource] = useState<'none' | 'auto' | 'manual'>('none');
  const [gitignoreContent, setGitignoreContent] = useState(DEFAULT_GITIGNORE_PATTERNS);
  const [showExcluded, setShowExcluded] = useState(false);
  const [forceIncludes, setForceIncludes] = useState<Set<string>>(new Set());

  // Stable helper
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
        if (forceIncludes.has(rp)) return true;
        return incSet.has(rp);
      }),
      excluded: rawFiles.filter((f) => {
        const rp = getRelativePath(f);
        if (forceIncludes.has(rp)) return false;
        return excSet.has(rp);
      }),
    };
  }, [rawFiles, gitignoreEnabled, gitignoreSource, gitignoreContent, forceIncludes, getRelativePath]);

  // Cache stats - force recompute via cacheVersion
  const cachedCount = useMemo(() => {
    let count = 0;
    for (const f of included) {
      if (fileCacheRef.current.has(getRelativePath(f))) count++;
    }
    return count;
  }, [included, getRelativePath, cacheVersion]);

  const allCached = cachedCount === included.length && included.length > 0;

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

  // Incremental file processing - runs in background when files are selected
  useEffect(() => {
    if (rawFiles.length === 0) return;

    const myId = ++processingIdRef.current;

    let cancelled = false;

    const process = async () => {
      setIsProcessing(true);
      setProcessingError(null);
      const total = rawFiles.length;
      setProcessingQueue(total);
      setProcessingDone(0);

      for (let i = 0; i < total; i++) {
        if (cancelled || processingIdRef.current !== myId) return;

        try {
          const f = rawFiles[i];
          const rp = f.relativePath.includes('/')
            ? f.relativePath.split('/').slice(1).join('/')
            : f.relativePath;

          // Skip if already cached
          if (fileCacheRef.current.has(rp)) {
            setProcessingDone(i + 1);
            if (i % 3 === 0) await yieldToMain();
            continue;
          }

          const buffer = await f.file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          fileCacheRef.current.set(rp, base64);
          setProcessingDone(i + 1);
          setCacheVersion((v) => v + 1); // trigger re-render for cachedCount

          // Yield every 3 files to keep UI responsive
          if (i % 3 === 0) {
            await yieldToMain();
          }
        } catch (err) {
          if (!cancelled) {
            setProcessingError(`Failed to read file: ${rawFiles[i].name}`);
          }
          setIsProcessing(false);
          return;
        }
      }

      if (!cancelled && processingIdRef.current === myId) {
        setIsProcessing(false);
      }
    };

    // Clean stale cache entries
    const currentPaths = new Set(rawFiles.map((f) => {
      return f.relativePath.includes('/')
        ? f.relativePath.split('/').slice(1).join('/')
        : f.relativePath;
    }));
    let hadCleanup = false;
    for (const key of fileCacheRef.current.keys()) {
      if (!currentPaths.has(key)) {
        fileCacheRef.current.delete(key);
        hadCleanup = true;
      }
    }
    if (hadCleanup) setCacheVersion((v) => v + 1);

    process();

    return () => {
      cancelled = true;
    };
  }, [rawFiles]);

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const items: FileItem[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      items.push({ name: f.name, relativePath: relPath, size: f.size, file: f });
    }
    setRawFiles(items);
    setForceIncludes(new Set());
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const items: FileItem[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      items.push({ name: f.name, relativePath: f.name, size: f.size, file: f });
    }
    setRawFiles(items);
    setForceIncludes(new Set());
    e.target.value = '';
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
    setPushProgress(0);

    try {
      // All files should already be cached from incremental processing
      const fileData: Array<{ path: string; content: string; isBase64: boolean }> = [];
      for (let i = 0; i < included.length; i++) {
        const f = included[i];
        const rp = getRelativePath(f);
        const cached = fileCacheRef.current.get(rp);
        if (cached) {
          fileData.push({ path: rp, content: cached, isBase64: true });
        } else {
          // Fallback: read on the fly (shouldn't normally happen)
          const buffer = await f.file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          fileData.push({ path: rp, content: base64, isBase64: true });
        }
        setPushProgress(Math.round(((i + 1) / included.length) * 90));
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

      setPushProgress(100);
      const excludedNote = excluded.length > 0 ? ` (${excluded.length} file(s) excluded by .gitignore)` : '';
      toast.success(`Pushed ${result.filesCommitted} file(s) in commit ${result.sha.slice(0, 7)}${excludedNote}`);
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Push failed.');
    } finally {
      setPushing(false);
      setPushProgress(0);
    }
  };

  const resetState = () => {
    setStep('message');
    setRawFiles([]);
    setCommitMessage('');
    setPushProgress(0);
    setGitignoreSource('none');
    setGitignoreContent(DEFAULT_GITIGNORE_PATTERNS);
    setForceIncludes(new Set());
    setShowExcluded(false);
    setProcessingQueue(0);
    setProcessingDone(0);
    setProcessingError(null);
    setIsProcessing(false);
    setCacheVersion(0);
    fileCacheRef.current.clear();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = included.reduce((sum, f) => sum + f.size, 0);
  const excludedSize = excluded.reduce((sum, f) => sum + f.size, 0);
  const processingPercent = processingQueue > 0 ? Math.round((processingDone / processingQueue) * 100) : 0;

  const canGoNext =
    step === 'message' ? commitMessage.trim().length > 0 :
    step === 'files' ? included.length > 0 && !isProcessing && !processingError :
    true;

  const stepLabels: Record<Step, string> = {
    message: 'Commit Message',
    files: 'Select Files',
    review: 'Review & Push',
  };
  const stepOrder: Step[] = ['message', 'files', 'review'];

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
            <span className="text-xs text-muted-foreground">
              Branch: <code className="rounded bg-muted px-1 font-mono">{selectedBranch || selectedRepo?.default_branch}</code>
              {filePath && (
                <span>
                  {' '}· Path: <code className="rounded bg-muted px-1 font-mono">{filePath}</code>
                </span>
              )}
            </span>
          </DialogDescription>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {stepOrder.map((s, i) => {
              const isActive = step === s;
              const isPast = stepOrder.indexOf(step) > i;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center justify-center size-6 rounded-full text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isPast
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isPast ? <Check className="size-3" /> : i + 1}
                    </div>
                    <span className={`text-xs hidden sm:inline ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {stepLabels[s]}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          {/* ==================== STEP 1: Commit Message ==================== */}
          {step === 'message' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="push-msg">Commit message</Label>
                <Input
                  id="push-msg"
                  placeholder="e.g. Add new feature files"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Describe what you are pushing. You will select files in the next step.
                </p>
              </div>
            </div>
          )}

          {/* ==================== STEP 2: Select Files ==================== */}
          {step === 'files' && (
            <div className="flex flex-col gap-4 py-2">
              {/* File selection buttons */}
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                    className="sr-only"
                    onChange={handleFolderSelect}
                    disabled={isProcessing || pushing}
                  />
                  <div className="flex items-center justify-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                    <FolderUp className="size-4" />
                    Select Folder
                  </div>
                </label>
                <label className="flex-1">
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={handleFileSelect}
                    disabled={isProcessing || pushing}
                  />
                  <div className="flex items-center justify-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="size-4" />
                    Select Files
                  </div>
                </label>
              </div>

              {/* Processing progress */}
              {(isProcessing || (processingDone > 0 && processingDone < processingQueue)) && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="size-3 animate-pulse" />
                      Caching files… {processingDone}/{processingQueue}
                    </span>
                    <span>{processingPercent}%</span>
                  </div>
                  <Progress value={processingPercent} className="h-1.5" />
                </div>
              )}

              {/* Processing complete notification */}
              {!isProcessing && processingDone > 0 && processingDone >= processingQueue && !processingError && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <Check className="size-3.5" />
                  <span>All {processingDone} file(s) cached and ready to push</span>
                </div>
              )}

              {/* Processing error */}
              {processingError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <FileX2 className="size-3.5" />
                  <span>{processingError}</span>
                </div>
              )}

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
                          <label className="cursor-pointer">
                            <input
                              ref={gitignoreFileRef}
                              type="file"
                              accept=".gitignore"
                              className="sr-only"
                              onChange={handleGitignoreFileUpload}
                              disabled={pushing}
                            />
                            <span className="flex items-center gap-1 h-7 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors">
                              <UploadCloud className="size-3" />
                              Load File
                            </span>
                          </label>
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
                              <><EyeOff className="size-3" /> Hide</>
                            ) : (
                              <><Eye className="size-3" /> Show</>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Excluded files list */}
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
                                  <span className="flex-1 truncate font-mono" title={rp}>{rp}</span>
                                  <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => toggleForceInclude(rp)}
                                        className="text-muted-foreground hover:text-green-600 transition-colors"
                                      >
                                        {isForced ? <ShieldOff className="size-3" /> : <ShieldCheck className="size-3" />}
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
                        <span className="text-orange-500"> ({excluded.length} excluded)</span>
                      )}
                    </span>
                    <span>{formatSize(totalSize)}</span>
                  </div>
                  <ScrollArea className="max-h-48">
                    <div className="divide-y">
                      {included.map((f, i) => {
                        const rp = getRelativePath(f);
                        const isCached = fileCacheRef.current.has(rp);
                        return (
                          <div key={`inc-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm group">
                            {isCached ? (
                              <Check className="size-3.5 text-green-600 shrink-0" />
                            ) : isProcessing ? (
                              <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                            ) : (
                              <FileText className="size-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1 truncate font-mono text-xs" title={rp}>{rp}</span>
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
                        );
                      })}
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
            </div>
          )}

          {/* ==================== STEP 3: Review & Push ==================== */}
          {step === 'review' && (
            <div className="flex flex-col gap-4 py-2">
              {/* Summary card */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Commit Message</span>
                  <code className="text-xs bg-muted rounded px-2 py-0.5 max-w-[60%] truncate block text-right" title={commitMessage}>
                    {commitMessage}
                  </code>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Branch</span>
                  <code className="text-xs bg-muted rounded px-2 py-0.5">
                    {selectedBranch || selectedRepo?.default_branch}
                  </code>
                </div>
                {filePath && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Path Prefix</span>
                      <code className="text-xs bg-muted rounded px-2 py-0.5">{filePath}</code>
                    </div>
                  </>
                )}
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Files</span>
                  <span className="text-sm">{included.length} file(s) · {formatSize(totalSize)}</span>
                </div>
                {excluded.length > 0 && gitignoreEnabled && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Excluded by .gitignore</span>
                    <span className="text-xs text-orange-500">{excluded.length} file(s) · {formatSize(excludedSize)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Status</span>
                  <span className={`text-xs ${allCached ? 'text-green-600' : 'text-orange-500'}`}>
                    {allCached ? 'All files cached ✓' : `${cachedCount}/${included.length} cached`}
                  </span>
                </div>
              </div>

              {/* File list */}
              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground font-medium">
                  Files to push
                </div>
                <ScrollArea className="max-h-48">
                  <div className="divide-y">
                    {included.map((f, i) => {
                      const rp = getRelativePath(f);
                      const isCached = fileCacheRef.current.has(rp);
                      return (
                        <div key={`rev-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                          {isCached ? (
                            <Check className="size-3.5 text-green-600 shrink-0" />
                          ) : (
                            <FileText className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="flex-1 truncate font-mono text-xs" title={rp}>{rp}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Push progress */}
              {pushing && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3 animate-spin" />
                      Uploading to GitHub…
                    </span>
                    <span>{pushProgress}%</span>
                  </div>
                  <Progress value={pushProgress} />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          {step === 'message' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('files')}
                disabled={!commitMessage.trim()}
                className="gap-1.5"
              >
                Next: Select Files
                <ChevronRight className="size-3.5" />
              </Button>
            </>
          )}
          {step === 'files' && (
            <>
              <Button variant="outline" onClick={() => setStep('message')} className="gap-1.5">
                <ArrowLeft className="size-3.5" />
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={!canGoNext}
                className="gap-1.5"
              >
                Next: Review
                <ChevronRight className="size-3.5" />
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('files')}
                disabled={pushing}
                className="gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </Button>
              <Button
                onClick={handlePush}
                disabled={pushing || included.length === 0 || !allCached}
                className="gap-1.5"
              >
                {pushing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {pushing ? 'Pushing…' : `Push ${included.length} File(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
