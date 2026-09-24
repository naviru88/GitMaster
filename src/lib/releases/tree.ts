import type {
  Release as PrismaRelease,
  ReleaseCommit as PrismaReleaseCommit,
  ReleaseLevel,
  ChangeType,
} from "@prisma/client";

import { compareVersionsForTree } from "./version";

// Public types
export interface ReleaseCommitNode {
  id: string;
  sha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: Date | null;
  changeType: ChangeType | null;
  note: string | null;
  order: number;
}

//A release with its children attached.
export interface ReleaseNode {
  id: string;
  projectId: string;
  version: string;
  level: ReleaseLevel;
  title: string | null;
  description: string | null;
  releasedAt: Date;
  published: boolean;
  parentId: string | null;
  order: number;
  commits: ReleaseCommitNode[];
  children: ReleaseNode[];
}

//Options for buildReleaseTree.
export interface BuildReleaseTreeOptions {
  //What to do when a node's parentId points to an id that isn't in theinput set.
  orphanStrategy?: "promote" | "drop";

  //What to do about cycles (e.g. v1.parentId = v1, or v1 → v2 → v1).
  cycleStrategy?: "break" | "throw";

  //Sort function for siblings.
  sort?: (a: string, b: string) => number;
}

export class TreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TreeError";
  }
}

// Main function
export function buildReleaseTree(
  rows: (PrismaRelease & { commits: PrismaReleaseCommit[] })[],
  options: BuildReleaseTreeOptions = {},
): ReleaseNode[] {
  const {
    orphanStrategy = "promote",
    cycleStrategy = "break",
    sort = compareVersionsForTree,
  } = options;

  // Step 1: Convert every row into a ReleaseNode shell
  const byId = new Map<string, ReleaseNode>();

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      projectId: row.projectId,
      version: row.version,
      level: row.level,
      title: row.title,
      description: row.description,
      releasedAt: row.releasedAt,
      published: row.published,
      parentId: row.parentId,
      order: row.order,
      commits: sortCommits(row.commits),
      children: [],
    });
  }

  // Step 2: Detect cycles before linking
  if (cycleStrategy === "throw") {
    const cycle = findCycle(byId);
    if (cycle) {
      throw new TreeError(
        `Cycle detected in release tree: ${cycle.join(" → ")}`,
      );
    }
  } else {
    breakCycles(byId);
  }

  // Step 3: Link children to their parents
  const roots: ReleaseNode[] = [];

  for (const node of byId.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(node.parentId);

    if (!parent) {
      // Orphan: parentId references a node that isn't in the input set.
      if (orphanStrategy === "promote") {
        node.parentId = null;
        roots.push(node);
      }
      // orphanStrategy === "drop" → do nothing, node is silently skipped
      continue;
    }

    parent.children.push(node);
  }

  // Step 4: Sort roots and every level of children
  const sortRecursive = (nodes: ReleaseNode[]) => {
    nodes.sort((a, b) => sort(a.version, b.version));
    for (const n of nodes) {
      sortRecursive(n.children);
    }
  };
  sortRecursive(roots);

  return roots;
}

// Helpers
function toCommitNode(row: PrismaReleaseCommit): ReleaseCommitNode {
  return {
    id: row.id,
    sha: row.sha,
    message: row.message,
    authorName: row.authorName ?? null,
    authorEmail: row.authorEmail ?? null,
    committedAt: row.committedAt ?? null,
    changeType: row.changeType ?? null,
    note: row.note ?? null,
    order: row.order,
  };
}

//Sort commits deterministically.
function sortCommits(rows: PrismaReleaseCommit[]): ReleaseCommitNode[] {
  return rows
    .map(toCommitNode)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      const at = a.committedAt?.getTime() ?? 0;
      const bt = b.committedAt?.getTime() ?? 0;
      if (at !== bt) return at - bt;
      return a.sha.localeCompare(b.sha);
    });
}

// Find a cycle in the parentId graph, if one exists.Returns the cycle as an array of ids, or null if no cycle.
function findCycle(byId: Map<string, ReleaseNode>): string[] | null {
  const WHITE = 0; // unvisited
  const GRAY = 1; // on current path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  for (const id of byId.keys()) color.set(id, WHITE);

  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    color.set(id, GRAY);
    stack.push(id);

    const node = byId.get(id);
    if (node?.parentId && byId.has(node.parentId)) {
      const parentColor = color.get(node.parentId);
      if (parentColor === GRAY) {
        // Cycle: slice from first occurrence of parentId
        const start = stack.indexOf(node.parentId);
        return [...stack.slice(start), node.parentId];
      }
      if (parentColor === WHITE) {
        const found = visit(node.parentId);
        if (found) return found;
      }
    }

    stack.pop();
    color.set(id, BLACK);
    return null;
  };

  for (const id of byId.keys()) {
    if (color.get(id) === WHITE) {
      const cycle = visit(id);
      if (cycle) return cycle;
    }
  }

  return null;
}

// Break any cycles in the parentId graph by detaching the node that wouldclose the loop..
function breakCycles(byId: Map<string, ReleaseNode>): void {
  for (const startId of byId.keys()) {
    const path = new Set<string>();
    let currentId: string | null = startId;

    while (currentId !== null) {
      if (path.has(currentId)) {
        // Cycle detected — break it by detaching the node that closed the loop
        const node = byId.get(currentId);
        if (node) node.parentId = null;
        break;
      }
      path.add(currentId);

      const node = byId.get(currentId);
      const nextId = node?.parentId ?? null;

      // If the parent is missing, no cycle possible
      if (nextId === null || !byId.has(nextId)) break;

      currentId = nextId;
    }
  }
}

// Convenience queries
export function flattenTree(nodes: ReleaseNode[]): ReleaseNode[] {
  const out: ReleaseNode[] = [];
  const walk = (list: ReleaseNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

// Find a node by version string. Returns null if not found.
export function findNodeByVersion(
  nodes: ReleaseNode[],
  version: string,
): ReleaseNode | null {
  for (const n of flattenTree(nodes)) {
    if (n.version === version) return n;
  }
  return null;
}

// Count all nodes in a tree (including nested).
export function countNodes(nodes: ReleaseNode[]): number {
  return flattenTree(nodes).length;
}
