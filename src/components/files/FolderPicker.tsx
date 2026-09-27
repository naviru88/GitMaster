'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Loader2, Home } from 'lucide-react';
import { github } from '@/services/api';
import { Button } from '@/components/ui/button';
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
}: FolderPickerProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
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
  }, [accountId, owner, repo, branch]);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

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
      <ScrollArea className="max-h-64">
        {tree.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">
            No subfolders in this repo.
          </p>
        ) : (
          tree.map((node) => (
            <FolderRow
              key={node.path}
              node={node}
              depth={0}
              selected={selected}
              onSelect={onSelect}
              excludePaths={excludePaths}
              expanded={expanded}
              onToggle={toggle}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
