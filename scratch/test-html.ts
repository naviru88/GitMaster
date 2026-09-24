import { buildReleaseTree } from "../src/lib/releases/tree";
import { generateReleaseHtml } from "../src/lib/releases/html-generator";
import { writeFileSync } from "fs";

const mk = (
  id: string,
  version: string,
  parentId: string | null,
  title: string | null = null,
  description: string | null = null,
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
  title,
  description,
  releasedAt: new Date("2026-09-24"),
  published: true,
  parentId,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  commits,
});

const mkCommit = (sha: string, message: string, changeType: any) => ({
  id: sha,
  releaseId: "r",
  sha,
  message,
  authorName: "Naviru",
  authorEmail: "n@example.com",
  committedAt: new Date("2026-09-20"),
  changeType,
  note: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const rows = [
  mk("a", "v1", null, "Initial Release", "First public release of GitMaster."),
  mk("b", "v1.0", "a", "MVP Launch", "Repository browsing, commits, and push/pull working.", [
    mkCommit("a3f8c21abc123", "Add repository list view", "ADDED"),
    mkCommit("b91e005def456", "Add commit history browser", "ADDED"),
  ]),
  mk("c", "v1.0.1", "b", "Bug fixes", null, [
    mkCommit("c44d112aaa111", "Handle empty repo state gracefully", "FIXED"),
  ]),
  mk("d", "v1.0.2", "b", "Auth patch", null, [
    mkCommit("d55e998bbb222", "Session cookie not cleared on logout", "FIXED"),
  ]),
  mk("e", "v1.1", "a", "Branch Management", "Branch CRUD.", [
    mkCommit("e77f201ccc333", "Add create/delete branch UI", "ADDED"),
    mkCommit("f88a309ddd444", "Refactor GitHub API client", "CHANGED"),
  ]),
  mk("f", "v2", null, "AI-Powered Tools", "Introducing AI assistance."),
];

const tree = buildReleaseTree(rows);
const html = generateReleaseHtml({
  repoName: "GitMaster",
  subtitle: "All releases for naviru88/GitMaster",
  tree,
});

writeFileSync("/tmp/gitmaster-releases.html", html);
console.log("✓ Wrote /tmp/gitmaster-releases.html");
console.log("  Size:", html.length, "bytes");

// Also verify basic structure
console.log("  Has v1 heading:", html.includes("v1"));
console.log("  Has v1.0.1 heading:", html.includes("v1.0.1"));
console.log("  Has commit sha:", html.includes("a3f8c21"));
console.log("  Has level class (major):", html.includes('release-major'));
console.log("  Has nested margin-left:", /margin-left:\s*\d/.test(html));
