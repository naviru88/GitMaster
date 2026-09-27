'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Loader2, Home, FolderPlus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { github } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

interface FolderPickerProps {
  accountId: string;
  owner: string;
  repo: string;
  branch?: string;
  selected: string;
  onSelect: (path: string) => void;
  excludePaths?: string[];
  allowCreate?: boolean;
  onFolderCreated?: (path: string) => void;
  enabled?: boolean;
}

function buildFolderTree(flatPaths: string[]): FolderNode[] {
  const root: FolderNode[] = [];
  const map = new Map<string, FolderNode>();

  const sorted = [...flatPaths].sort();
  for (const path of sorted) {
    const segments = path.split('/');
    let currentPath = '';
    let siblings = root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;

      let node = map.get(currentPath);
      if (!node) {
        node = { name: seg, path: currentPath, children: [] };
        map.set(currentPath, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
  }

  return root;
}

function collectFolderPaths(treeEntries: { path: string; type: string }[]): string[] {
  const set = new Set<string>();
  for (const entry of treeEntries) {
    if (entry.type !== 'tree') continue;
    set.add(entry.path);
  }
  return Array.from(set);
}

function FolderRow({
  node,
  depth,
  selected,
  onSelect,
  excludePaths,
  expanded,
  onToggle,
}: {
  node: FolderNode;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
  excludePaths: string[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isExcluded = excludePaths.some(
    (p) => node.path === p || node.path.startsWith(p + '/'),
  );
  const isSelected = selected === node.path;
  const isExpanded = expanded.has(node.path);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-sm text-sm cursor-pointer transition-colors ${
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
        } ${isExcluded ? 'opacity-40 cursor-not-allowed' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => !isExcluded && onSelect(node.path)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren && !isExcluded) onToggle(node.path);
          }}
          className="size-4 flex items-center justify-center shrink-0"
        >
          {hasChildren && !isExcluded ? (
            isExpanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : null}
        </button>
        <Folder className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate font-mono text-xs">{node.name}</span>
      </div>
      {isExpanded &&
        !isExcluded &&
        node.children.map((child) => (
          <FolderRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            excludePaths={excludePaths}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export default function FolderPicker({
  accountId,
  owner,
  repo,
  branch,
  selected,
  onSelect,
  excludePaths = [],
  allowCreate = true,
  onFolderCreated,
  enabled = true,
}: FolderPickerProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await github.contents.tree(accountId, owner, repo, branch);
        if (cancelled) return;
        setFolders(collectFolderPaths(result.tree));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load folders.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!enabled) return;
    if (!accountId || !owner || !repo) return;
    const cancel = reload();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, owner, repo, branch, enabled]);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const startCreating = (parentPath: string) => {
    setCreatingIn(parentPath);
    setNewFolderName('');
    if (parentPath && !expanded.has(parentPath)) {
      setExpanded((prev) => new Set(prev).add(parentPath));
    }
  };

  const cancelCreating = () => {
    setCreatingIn(null);
    setNewFolderName('');
  };

  const commitCreate = async (parentPath: string) => {
    const name = newFolderName.trim();
    if (!name) {
      cancelCreating();
      return;
    }
    if (name.includes('/') || name.includes('\\')) {
      toast.error('Folder name cannot contain slashes');
      return;
    }
    if (name === '.' || name === '..') {
      toast.error('Invalid folder name');
      return;
    }

    const newPath = parentPath ? `${parentPath}/${name}` : name;
    if (folders.includes(newPath)) {
      toast.error(`Folder "${name}" already exists here`);
      return;
    }

    setCreating(true);
    try {
      const placeholderPath = `${newPath}/.gitkeep`;
      await github.contents.saveFile(
        accountId,
        owner,
        repo,
        placeholderPath,
        '',
        `Create folder ${newPath}`,
        undefined,
        branch,
        false,
      );
      toast.success(`Created folder ${newPath}`);
      onFolderCreated?.(newPath);
      onSelect(newPath);
      cancelCreating();
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create folder.');
    } finally {
      setCreating(false);
    }
  };

  if (!enabled) {
    return (
      <div className="text-xs text-muted-foreground px-3 py-4 text-center">
        Loading folders…
      </div>
    );
  }

  const renderInlineCreator = (parentPath: string, depth: number) => (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-sm"
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <span className="size-4 shrink-0" />
      <Folder className="size-3.5 text-primary shrink-0" />
      <Input
        autoFocus
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitCreate(parentPath);
          if (e.key === 'Escape') cancelCreating();
        }}
        placeholder="new-folder"
        disabled={creating}
        className="h-6 text-xs font-mono flex-1"
      />
      <button
        onClick={() => commitCreate(parentPath)}
        disabled={creating || !newFolderName.trim()}
        className="text-green-600 hover:text-green-700 disabled:opacity-40 shrink-0"
      >
        {creating ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      </button>
      <button
        onClick={cancelCreating}
        disabled={creating}
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="size-3" />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-1.5 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-3.5" />
            <Skeleton className="h-3.5" style={{ width: `${60 + i * 10}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <p className="text-xs text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {allowCreate && (
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs text-muted-foreground">Folders</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => startCreating(selected || '')}
            disabled={creatingIn !== null || creating}
          >
            <FolderPlus className="size-3" />
            New folder
          </Button>
        </div>
      )}

      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-sm text-sm cursor-pointer transition-colors ${
          selected === '' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
        }`}
        onClick={() => onSelect('')}
      >
        <span className="size-4 shrink-0" />
        <Home className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate font-mono text-xs">/ (root)</span>
      </div>

      {creatingIn === '' && renderInlineCreator('', 0)}

      <ScrollArea className="max-h-64">
        {tree.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">
            No subfolders in this repo.
          </p>
        ) : (
          tree.map((node) => (
            <React.Fragment key={node.path}>
              <FolderRow
                node={node}
                depth={0}
                selected={selected}
                onSelect={onSelect}
                excludePaths={excludePaths}
                expanded={expanded}
                onToggle={toggle}
              />
              {creatingIn === node.path && renderInlineCreator(node.path, 1)}
            </React.Fragment>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
