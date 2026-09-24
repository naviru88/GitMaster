import { buildReleaseTree } from "../src/lib/releases/tree";

const mk = (
  id: string,
  version: string,
  parentId: string | null,
  commits: any[] = [],
) => ({
  id,
  projectId: "p1",
  version,
  level: version.split(".").length === 1
    ? "MAJOR" as const
    : version.split(".").length === 2
      ? "MINOR" as const
      : "PATCH" as const,
  title: null,
  description: null,
  releasedAt: new Date(),
  published: true,
  parentId,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  commits,
});

const rows = [
  mk("a", "v1", null),
  mk("b", "v1.0", "a"),
  mk("c", "v1.0.1", "b"),
  mk("d", "v1.0.2", "b"),
  mk("e", "v1.1", "a"),
  mk("f", "v2", null),
];

const tree = buildReleaseTree(rows);

console.log("Roots:", tree.map((n) => n.version));
console.log("v1 children:", tree[0].children.map((n) => n.version));
console.log("v1.0 children:", tree[0].children[0].children.map((n) => n.version));
console.log("---");
const print = (nodes: any[], depth = 0) => {
  for (const n of nodes) {
    console.log("  ".repeat(depth) + n.version);
    print(n.children, depth + 1);
  }
};
print(tree);

console.log("\n=== Orphan test ===");
const orphanRows = [mk("a", "v1", null), mk("b", "v1.0", "MISSING")];
console.log(buildReleaseTree(orphanRows).map((n) => n.version));

console.log("\n=== Cycle test ===");
const cycleRows = [mk("a", "v1", "a")];
console.log(buildReleaseTree(cycleRows).map((n) => n.version));
