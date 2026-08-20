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

/** GitHub's own ceiling for a single blob via the Git Data API. */
const GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024;

/** GitHub's Git Trees API unconditionally rejects any path with a `.git`
 * path component (case-insensitive) — this is a hard restriction on their
 * end ("tree.path contains a malformed path component"), not a preference.
 * It must be enforced regardless of .gitignore state, because:
 *  - a project's own .gitignore file almost never lists `.git/` itself,
 *    since real git never needs to be told to ignore its own directory —
 *    but this app reads the raw filesystem, so a selected/dropped folder's
 *    literal .git/ directory is fair game unless blocked here directly.
 *  - even where it wouldn't be rejected, pushing .git internals (config,
 *    refs, COMMIT_EDITMSG — potentially credentials) is never wanted.
 * Because GitHub will always reject these, this block is intentionally
 * NOT overridable via "force include", unlike ordinary .gitignore matches.
 */
function isBlockedGitPath(path: string): boolean {
  return path.split('/').some((seg) => seg.toLowerCase() === '.git');
}

/** Read a File as base64 via the browser's native FileReader instead of
 * manually chunking bytes through String.fromCharCode + btoa. The manual
 * loop was the main source of the "very slow / freezes" push behavior —
 * FileReader.readAsDataURL is implemented natively by the browser and is
 * both faster and far less likely to block/crash the tab on larger files. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:<mime>;base64,XXXX"
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.onabort = () => reject(new Error('File read was aborted'));
    reader.readAsDataURL(file);
  });
}

/** Run async work with bounded concurrency. Used so multiple files are
 * read/encoded in parallel (I/O is async, so this is a real speedup) without
 * ever holding the *entire* batch in flight at once — which is what risked
 * ballooning memory and crashing the tab on large pushes. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function runNext(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
}

/** Yield to the event loop so the UI doesn't freeze */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Read a FileSystemFileEntry as a File */
function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** FileSystemDirectoryReader.readEntries only returns up to ~100 entries per
 * call in Chromium browsers, so it must be called repeatedly until it
 * returns an empty array. */
function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

/** Recursively walk a dropped FileSystemEntry (file or directory) and push
 * every file found into `collected`, preserving folder structure via
 * `entry.fullPath` (which is what makes drag-and-drop able to replicate
 * "Select Folder" without going through the native file picker at all).
 * `onFileFound` fires as each file is discovered — this is what drives the
 * live "Scanning… found N files" indicator, since a large project (tens of
 * thousands of entries, e.g. node_modules) can take a real, visible amount
 * of time to walk with zero other feedback otherwise. */
async function collectFilesFromEntry(
  entry: FileSystemEntry,
  collected: FileItem[],
  onFileFound?: () => void,
): Promise<void> {
  if (entry.isFile) {
    const file = await readEntryAsFile(entry as FileSystemFileEntry);
    const relPath = (entry.fullPath || `/${file.name}`).replace(/^\//, '');
    collected.push({ name: file.name, relativePath: relPath, size: file.size, file });
    onFileFound?.();
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let entries: FileSystemEntry[] = [];
    // Keep calling readEntries until it returns [] — a single call is not
    // guaranteed to return the full directory listing.
    while (true) {
      const batch = await readDirectoryEntries(reader);
      if (batch.length === 0) break;
      entries = entries.concat(batch);
    }
    for (const child of entries) {
      await collectFilesFromEntry(child, collected, onFileFound);
    }
  }
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // While a dropped folder is being recursively walked (which is silent
  // otherwise, and can take real time for large projects), this drives a
  // live "Scanning… found N files" indicator instead of the UI looking
  // frozen with no feedback at all.
  const [scanningCount, setScanningCount] = useState<number | null>(null);
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

  // Failsafe: files that failed to read/encode, or that are too large for
  // GitHub's blob API. Tracked separately from .gitignore exclusion so the
  // UI can explain *why* each file was skipped, and so one bad file never
  // blocks the rest of the batch.
  const [invalidFiles, setInvalidFiles] = useState<Map<string, string>>(new Map());

  // Stable helper
  const getRelativePath = useCallback((item: FileItem) => {
    return item.relativePath.includes('/')
      ? item.relativePath.split('/').slice(1).join('/')
      : item.relativePath;
  }, []);

  // Apply gitignore filtering
  // NOTE: we intentionally do NOT gate this on `gitignoreSource !== 'none'`.
  // `gitignoreContent` is always initialized to DEFAULT_GITIGNORE_PATTERNS, so
  // even when no .gitignore has been auto-detected or uploaded ("none"), the
  // sensible defaults (node_modules/, .git/, .DS_Store, *.log, ...) must still
  // apply whenever gitignoreEnabled is on. `gitignoreSource` is purely a UI
  // label (auto-detected / uploaded / none) and must never affect filtering.
  const { included, excluded } = useMemo(() => {
    if (rawFiles.length === 0) {
      return { included: [] as FileItem[], excluded: [] as FileItem[] };
    }

    // Hard block for .git/ paths — applies even with .gitignore filtering
    // toggled off, and is never overridable via forceIncludes (see
    // isBlockedGitPath above for why).
    const gitBlocked = new Set(
      rawFiles.map((f) => getRelativePath(f)).filter(isBlockedGitPath),
    );

    if (!gitignoreEnabled) {
      return {
        included: rawFiles.filter((f) => !gitBlocked.has(getRelativePath(f))),
        excluded: rawFiles.filter((f) => gitBlocked.has(getRelativePath(f))),
      };
    }

    const allPaths = rawFiles.map((f) => getRelativePath(f)).filter((p) => !gitBlocked.has(p));
    const { included: incPaths, excluded: excPaths } = filterByGitignore(allPaths, gitignoreContent);
    const incSet = new Set(incPaths);
    const excSet = new Set(excPaths);

    return {
      included: rawFiles.filter((f) => {
        const rp = getRelativePath(f);
        if (gitBlocked.has(rp)) return false;
        if (forceIncludes.has(rp)) return true;
        return incSet.has(rp);
      }),
      excluded: rawFiles.filter((f) => {
        const rp = getRelativePath(f);
        if (gitBlocked.has(rp)) return true;
        if (forceIncludes.has(rp)) return false;
        return excSet.has(rp);
      }),
    };
  }, [rawFiles, gitignoreEnabled, gitignoreContent, forceIncludes, getRelativePath]);

  // Files that pass .gitignore filtering AND are actually readable/valid.
  // This is the list that gets cached and pushed — invalid files are
  // automatically excluded rather than blocking the rest of the batch.
  const pushable = useMemo(
    () => included.filter((f) => !invalidFiles.has(getRelativePath(f))),
    [included, invalidFiles, getRelativePath],
  );

  // Cache stats - force recompute via cacheVersion
  const cachedCount = useMemo(() => {
    let count = 0;
    for (const f of pushable) {
      if (fileCacheRef.current.has(getRelativePath(f))) count++;
    }
    return count;
  }, [pushable, getRelativePath, cacheVersion]);

  const allCached = cachedCount === pushable.length && pushable.length > 0;

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

  // Incremental file processing - runs in background when the *included*
  // (post-.gitignore-filter) file set changes.
  //
  // IMPORTANT: this intentionally reads from `included`, not `rawFiles`.
  // Reading/base64-encoding a file is the expensive part of a push (it's
  // what actually consumes memory and inflates the request payload), so we
  // must never do that work for files that .gitignore is going to exclude
  // anyway (e.g. node_modules/, build output, lockfile noise, etc). Doing so
  // was previously silently processing every selected file regardless of
  // filtering, which both slowed down file selection and defeated the whole
  // point of .gitignore-based exclusion (reducing upload size/capacity).
  useEffect(() => {
    if (included.length === 0) return;

    const myId = ++processingIdRef.current;
    let cancelled = false;

    const process = async () => {
      setIsProcessing(true);
      setProcessingError(null);
      const total = included.length;
      setProcessingQueue(total);
      let doneCount = 0;
      setProcessingDone(0);

      const newlyInvalid = new Map<string, string>();

      // CONCURRENCY: read/encode multiple files at once instead of one at a
      // time. This is local disk I/O via FileReader, not a network call to
      // GitHub — there's no abuse-detection concern here (unlike the
      // server-side blob upload concurrency, which is deliberately capped
      // low). 8 gives a real speedup while still leaving enough headroom
      // that a handful of large files in flight together won't spike memory
      // or freeze the tab.
      const READ_CONCURRENCY = 8;

      await runWithConcurrency(included, READ_CONCURRENCY, async (f) => {
        if (cancelled || processingIdRef.current !== myId) return;

        const rp = getRelativePath(f);

        // Skip if already cached
        if (fileCacheRef.current.has(rp)) {
          doneCount++;
          setProcessingDone(doneCount);
          return;
        }

        // FAILSAFE 1: reject files GitHub's blob API can't accept anyway,
        // without ever reading their bytes into memory.
        if (f.size > GITHUB_MAX_FILE_BYTES) {
          newlyInvalid.set(rp, `Too large (${(f.size / 1024 / 1024).toFixed(1)}MB) — GitHub's limit is 100MB per file`);
          doneCount++;
          setProcessingDone(doneCount);
          return;
        }

        // FAILSAFE 2: a corrupted/unreadable/permission-denied file is
        // caught and skipped here, per-file — it no longer halts the rest
        // of the batch the way a single failure previously did.
        try {
          const base64 = await fileToBase64(f.file);
          if (cancelled || processingIdRef.current !== myId) return;
          fileCacheRef.current.set(rp, base64);
          setCacheVersion((v) => v + 1);
        } catch (err) {
          newlyInvalid.set(rp, err instanceof Error ? err.message : 'Could not be read (possibly corrupted)');
        }

        doneCount++;
        setProcessingDone(doneCount);
        await yieldToMain();
      });

      if (cancelled || processingIdRef.current !== myId) return;

      if (newlyInvalid.size > 0) {
        setInvalidFiles((prev) => {
          const next = new Map(prev);
          for (const [k, v] of newlyInvalid) next.set(k, v);
          return next;
        });
      }

      setIsProcessing(false);
    };

    // Clean stale cache/invalid entries — anything no longer in the included
    // set (removed by the user, or newly excluded by .gitignore) should not
    // linger in memory or get pushed.
    const currentPaths = new Set(included.map((f) => getRelativePath(f)));
    let hadCleanup = false;
    for (const key of fileCacheRef.current.keys()) {
      if (!currentPaths.has(key)) {
        fileCacheRef.current.delete(key);
        hadCleanup = true;
      }
    }
    if (hadCleanup) setCacheVersion((v) => v + 1);
    setInvalidFiles((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!currentPaths.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    process();

    return () => {
      cancelled = true;
    };
  }, [included, getRelativePath]);

  // Immediate confirmation the instant a selection registers, so there's
  // never a gap where the user can't tell whether anything happened. Larger
  // batches get an extra heads-up that it'll take a moment.
  const notifySelection = (count: number) => {
    if (count > 500) {
      toast.info(`${count} files selected — this may take a bit to read and cache before pushing.`);
    } else {
      toast.success(`${count} file(s) selected — reading and caching now…`);
    }
  };

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
    setInvalidFiles(new Map());
    notifySelection(items.length);
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
    setInvalidFiles(new Map());
    notifySelection(items.length);
    e.target.value = '';
  };

  // ==================== Drag & drop (bypasses the native file picker) ====================
  // Uses a counter ref instead of a plain boolean because dragenter/dragleave
  // fire repeatedly as the pointer crosses child elements inside the drop
  // zone; a naive boolean flag flickers the overlay on/off constantly.
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing || pushing) return;
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current += 1;
    setIsDraggingOver(true);
  }, [isProcessing, pushing]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // preventDefault is required here, or the browser will refuse the drop
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (isProcessing || pushing) return;

    const dt = e.dataTransfer;
    const collected: FileItem[] = [];

    // Immediate feedback the moment the drop is registered — before any
    // traversal has happened yet, so there's never a silent gap.
    setScanningCount(0);
    let lastToastUpdate = 0;

    try {
      const items = dt.items;
      if (items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === 'function') {
        // Modern path (Chrome/Brave/Firefox): supports whole folders,
        // recursively, with structure preserved via entry.fullPath.
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind !== 'file') continue;
          const entry = item.webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
        for (const entry of entries) {
          await collectFilesFromEntry(entry, collected, () => {
            // Batch state updates roughly every 20 files instead of on
            // every single one — thousands of individual re-renders during
            // a big node_modules scan would itself slow things down.
            if (collected.length - lastToastUpdate >= 20) {
              lastToastUpdate = collected.length;
              setScanningCount(collected.length);
            }
          });
        }
      }

      // Fallback: flat file list only (no folder structure) — used if the
      // browser doesn't support webkitGetAsEntry at all.
      if (collected.length === 0 && dt.files && dt.files.length > 0) {
        for (let i = 0; i < dt.files.length; i++) {
          const f = dt.files[i];
          collected.push({ name: f.name, relativePath: f.name, size: f.size, file: f });
        }
      }
    } catch (err) {
      toast.error('Failed to read the dropped files or folder.');
      setScanningCount(null);
      return;
    }

    setScanningCount(null);

    if (collected.length === 0) {
      toast.error('No files found in what was dropped.');
      return;
    }

    toast.success(`Found ${collected.length} file(s) — reading and caching now…`);

    // Merge into the existing selection: dropping more files/folders adds to
    // what's already selected, with a re-drop of the same path overwriting
    // the earlier version rather than duplicating it.
    setRawFiles((prev) => {
      const map = new Map(prev.map((f) => [f.relativePath, f]));
      for (const f of collected) map.set(f.relativePath, f);
      const merged = Array.from(map.values());
      return merged;
    });
    setForceIncludes(new Set());
  }, [isProcessing, pushing]);

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
    if (!selectedAccountId || !selectedRepo || pushable.length === 0) return;
    const msg = commitMessage.trim() || 'Push files';
    const branch = selectedBranch || selectedRepo.default_branch;

    setPushing(true);
    setPushProgress(0);

    // A single evolving toast (loading → success/error) instead of a bare
    // one-line message that only appears at the very end. This is the main
    // "something is happening" signal — it stays visible even if the person
    // switches tabs or scrolls the dialog, and it's driven by sonner's
    // richColors theme rather than a default unstyled browser notification.
    const toastId = toast.loading(`Preparing ${pushable.length} file(s)…`, {
      description: 'Reading and encoding files before upload.',
    });

    try {
      // All files should already be cached from incremental processing
      const fileData: Array<{ path: string; content: string; isBase64: boolean }> = [];
      for (let i = 0; i < pushable.length; i++) {
        const f = pushable[i];
        const rp = getRelativePath(f);
        const cached = fileCacheRef.current.get(rp);
        if (cached) {
          fileData.push({ path: rp, content: cached, isBase64: true });
        } else {
          // Fallback: read on the fly (shouldn't normally happen, since the
          // background caching effect should have already handled it). Any
          // failure here is caught per-file so one bad file doesn't abort
          // an otherwise-ready push — it's just skipped and reported.
          try {
            const base64 = await fileToBase64(f.file);
            fileData.push({ path: rp, content: base64, isBase64: true });
          } catch (err) {
            setInvalidFiles((prev) => new Map(prev).set(rp, err instanceof Error ? err.message : 'Could not be read'));
          }
        }
        setPushProgress(Math.round(((i + 1) / pushable.length) * 90));
        // Don't spam the toast with a re-render on every single file —
        // update it periodically so the count still visibly ticks up.
        if (i % 10 === 0 || i === pushable.length - 1) {
          toast.loading(`Preparing files… (${i + 1}/${pushable.length})`, { id: toastId });
        }
      }

      if (fileData.length === 0) {
        toast.error('Nothing to push', {
          id: toastId,
          description: 'All selected files were skipped as invalid.',
        });
        return;
      }

      toast.loading(`Uploading ${fileData.length} file(s) to GitHub…`, {
        id: toastId,
        description: `${selectedRepo.owner.login}/${selectedRepo.name} · ${branch}`,
      });

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
      const skippedParts = [
        excluded.length > 0 ? `${excluded.length} excluded by .gitignore` : null,
        invalidFiles.size > 0 ? `${invalidFiles.size} skipped as invalid` : null,
      ].filter(Boolean);
      const skippedNote = skippedParts.length > 0 ? ` · ${skippedParts.join(', ')}` : '';
      toast.success(`Pushed ${result.filesCommitted} file(s) to ${branch}`, {
        id: toastId,
        description: `Commit ${result.sha.slice(0, 7)}${skippedNote}`,
      });
      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error('Push failed', {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unknown error — please try again.',
      });
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
    setInvalidFiles(new Map());
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

  const totalSize = pushable.reduce((sum, f) => sum + f.size, 0);
  const excludedSize = excluded.reduce((sum, f) => sum + f.size, 0);
  const processingPercent = processingQueue > 0 ? Math.round((processingDone / processingQueue) * 100) : 0;

  const canGoNext =
    step === 'message' ? commitMessage.trim().length > 0 :
    step === 'files' ? pushable.length > 0 && !isProcessing && !processingError :
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
        if (!v && pushing) {
          // Prevent the dialog (and its close-guarded toast) from vanishing
          // mid-upload — closing here would abandon visibility into an
          // in-flight push with no way to tell if it actually finished.
          toast.info('Push in progress — please wait for it to finish.');
          return;
        }
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

        {/* Upload progress — deliberately placed OUTSIDE the scrollable
            content area (shrink-0, not inside overflow-y-auto) so it stays
            visible no matter how far the file list is scrolled. This is the
            main "the site is doing something" signal during the actual
            network upload. */}
        {pushing && (
          <div className="shrink-0 flex flex-col gap-1.5 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                {pushProgress < 90 ? 'Preparing files…' : 'Uploading to GitHub…'}
              </span>
              <span className="text-muted-foreground">{pushProgress}%</span>
            </div>
            <Progress value={pushProgress} className="h-2" />
          </div>
        )}

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
            <div
              className="flex flex-col gap-4 py-2 relative"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag-and-drop overlay */}
              {isDraggingOver && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px] pointer-events-none">
                  <UploadCloud className="size-8 text-primary" />
                  <p className="text-sm font-medium text-primary">Drop files or folders to add them</p>
                </div>
              )}

              {/* Live folder-scan progress — this is the "something is
                  happening" signal during recursive directory traversal,
                  which otherwise has zero feedback while it runs. */}
              {scanningCount !== null && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                  <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                  <span>Scanning folder… found <span className="font-medium">{scanningCount}</span> file(s) so far</span>
                </div>
              )}

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

              {rawFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-center">
                  <UploadCloud className="size-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Or drag and drop files or a whole folder here
                  </p>
                </div>
              )}

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

                  {excluded.length > 0 && (
                    <>
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

                      {/* Excluded files list */}
                      {showExcluded && (
                        <ScrollArea className="max-h-28 mb-2">
                          <div className="divide-y rounded border bg-destructive/5">
                            {excluded.map((f, i) => {
                              const rp = getRelativePath(f);
                              const isForced = forceIncludes.has(rp);
                              const isGitBlocked = isBlockedGitPath(rp);
                              return (
                                <div
                                  key={`exc-${i}`}
                                  className={`flex items-center gap-2 px-3 py-1 text-xs group ${isForced ? 'opacity-50 line-through' : ''}`}
                                >
                                  <Checkbox
                                    checked={isForced}
                                    onCheckedChange={() => !isGitBlocked && toggleForceInclude(rp)}
                                    disabled={isGitBlocked}
                                    className="size-3.5"
                                  />
                                  <FileText className="size-3 text-muted-foreground shrink-0" />
                                  <span className={`flex-1 truncate font-mono ${isGitBlocked ? 'text-destructive' : ''}`} title={isGitBlocked ? `${rp} — GitHub rejects .git/ paths, cannot be pushed` : rp}>
                                    {rp}
                                    {isGitBlocked && <span className="text-destructive/70"> — blocked by GitHub</span>}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                                  {isGitBlocked ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <ShieldOff className="size-3 text-destructive/60" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        GitHub's API always rejects .git/ paths — this can't be force-included
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
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
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </>
                  )}

                  {/* Editable gitignore content — independent of whether
                      anything is currently excluded; rules can be added
                      proactively before any file happens to match them. */}
                  {gitignoreEnabled && gitignoreSource !== 'none' && (
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
                  )}

                  {gitignoreEnabled && gitignoreSource === 'none' && (
                    <p className="text-xs text-muted-foreground">
                      Applying default rules (node_modules/, .git/, .DS_Store, Thumbs.db, *.log).{' '}
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
                      .gitignore filtering is disabled — all other selected files will be pushed. (.git/ paths are always excluded, since GitHub's API rejects them regardless.)
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
                      {pushable.length} file(s) to push
                      {excluded.length > 0 && (
                        <span className="text-orange-500"> ({excluded.length} excluded)</span>
                      )}
                      {invalidFiles.size > 0 && (
                        <span className="text-destructive"> ({invalidFiles.size} invalid)</span>
                      )}
                    </span>
                    <span>{formatSize(totalSize)}</span>
                  </div>
                  <ScrollArea className="max-h-48">
                    <div className="divide-y">
                      {included.map((f, i) => {
                        const rp = getRelativePath(f);
                        const isCached = fileCacheRef.current.has(rp);
                        const invalidReason = invalidFiles.get(rp);
                        return (
                          <div key={`inc-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm group">
                            {invalidReason ? (
                              <FileX2 className="size-3.5 text-destructive shrink-0" />
                            ) : isCached ? (
                              <Check className="size-3.5 text-green-600 shrink-0" />
                            ) : isProcessing ? (
                              <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                            ) : (
                              <FileText className="size-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className={`flex-1 truncate font-mono text-xs ${invalidReason ? 'text-destructive' : ''}`} title={invalidReason ? `${rp} — ${invalidReason}` : rp}>
                              {rp}
                              {invalidReason && <span className="text-destructive/80"> — {invalidReason}</span>}
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
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* No files left to push after filtering + invalid-file exclusion */}
              {rawFiles.length > 0 && pushable.length === 0 && (
                <div className="border rounded-lg p-4 text-center">
                  <FileX2 className="size-8 mx-auto text-orange-500 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {included.length === 0
                      ? `All ${rawFiles.length} selected file(s) match .gitignore rules.`
                      : `All ${included.length} remaining file(s) failed validation.`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {included.length === 0
                      ? 'Show excluded files to force-include specific ones, or disable .gitignore filtering.'
                      : 'See the reasons listed next to each file above.'}
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
                  <span className="text-sm">{pushable.length} file(s) · {formatSize(totalSize)}</span>
                </div>
                {excluded.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Excluded</span>
                    <span className="text-xs text-orange-500">{excluded.length} file(s) · {formatSize(excludedSize)}</span>
                  </div>
                )}
                {invalidFiles.size > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Skipped as invalid</span>
                    <span className="text-xs text-destructive">{invalidFiles.size} file(s)</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Status</span>
                  <span className={`text-xs ${allCached ? 'text-green-600' : 'text-orange-500'}`}>
                    {allCached ? 'All files cached ✓' : `${cachedCount}/${pushable.length} cached`}
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
                    {pushable.map((f, i) => {
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
                disabled={pushing || pushable.length === 0 || !allCached}
                className="gap-1.5"
              >
                {pushing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {pushing ? 'Pushing…' : `Push ${pushable.length} File(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
