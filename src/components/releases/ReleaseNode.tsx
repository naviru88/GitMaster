'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronRight,
  ChevronDown,
  GitCommit,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Release, ReleaseCommit } from '@/services/api';

// Same icons + colors as the HTML generator, so web view and exported document look consistent.
const LEVEL_ICON: Record<Release['level'], string> = {
  MAJOR: '🔴',
  MINOR: '🟡',
  PATCH: '🟢',
};

const LEVEL_BORDER: Record<Release['level'], string> = {
  MAJOR: 'border-l-red-500',
  MINOR: 'border-l-amber-500',
  PATCH: 'border-l-green-500',
};

const LEVEL_TEXT_SIZE: Record<Release['level'], string> = {
  MAJOR: 'text-lg font-bold',
  MINOR: 'text-base font-semibold',
  PATCH: 'text-sm font-medium',
};

const CHANGE_TYPE_COLOR: Record<NonNullable<ReleaseCommit['changeType']>, string> = {
  ADDED: 'text-green-600 dark:text-green-400 border-green-500/40',
  CHANGED: 'text-blue-600 dark:text-blue-400 border-blue-500/40',
  FIXED: 'text-cyan-600 dark:text-cyan-400 border-cyan-500/40',
  REMOVED: 'text-red-600 dark:text-red-400 border-red-500/40',
  DEPRECATED: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/40',
  SECURITY: 'text-purple-600 dark:text-purple-400 border-purple-500/40',
};

interface ReleaseNodeProps {
  node: Release;
  depth: number;
  onEdit: (node: Release) => void;
  onDelete: (node: Release) => void;
  onTogglePublished: (node: Release) => void;
}

export default function ReleaseNode({
  node,
  depth,
  onEdit,
  onDelete,
  onTogglePublished,
}: ReleaseNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const hasCommits = node.commits.length > 0;
  const expandable = hasChildren || hasCommits;

  // Visual indentation capped at 4 levels to avoid excessive drift
  const indentRem = Math.min(depth, 4) * 1.5;

  return (
    <div className="flex flex-col">
      <div
        className={`border-l-4 ${LEVEL_BORDER[node.level]} pl-3 py-2 rounded-r-md hover:bg-accent/30 transition-colors`}
        style={{ marginLeft: `${indentRem}rem` }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2">
          {expandable ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : (
            <span className="size-4 shrink-0" />
          )}

          <span className="text-lg shrink-0" aria-hidden>
            {LEVEL_ICON[node.level]}
          </span>

          <span className={`font-mono ${LEVEL_TEXT_SIZE[node.level]}`}>
            {node.version}
          </span>

          {node.title && (
            <span className="text-sm text-muted-foreground truncate">
              — {node.title}
            </span>
          )}

          {!node.published && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              draft
            </Badge>
          )}

          {/* Actions — only on hover */}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onTogglePublished(node)}
                >
                  {node.published ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {node.published ? 'Unpublish' : 'Publish'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onEdit(node)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(node)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Meta row: date + optional description */}
        <div className="ml-10 mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">
            {formatDistanceToNow(new Date(node.releasedAt), { addSuffix: true })}
          </span>
          {hasCommits && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <GitCommit className="size-3" />
                {node.commits.length} commit{node.commits.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="ml-10 mt-2 flex flex-col gap-2">
            {node.description && (
              <p className="text-sm whitespace-pre-wrap">{node.description}</p>
            )}

            {hasCommits && (
              <ul className="flex flex-col gap-1">
                {node.commits.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 text-xs py-1"
                  >
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {c.sha.slice(0, 7)}
                    </code>
                    {c.changeType && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${CHANGE_TYPE_COLOR[c.changeType]}`}
                      >
                        {c.changeType}
                      </span>
                    )}
                    <span className="truncate">{c.message}</span>
                    {c.note && (
                      <span className="text-muted-foreground italic truncate">
                        — {c.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Children — nested inside this wrapper for correct indentation */}
      {expanded && hasChildren && (
        <div className="flex flex-col gap-1 mt-1">
          {node.children.map((child) => (
            <ReleaseNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePublished={onTogglePublished}
            />
          ))}
        </div>
      )}
    </div>
  );
}
