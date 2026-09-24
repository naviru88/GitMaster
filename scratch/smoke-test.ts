import { PrismaClient, ChangeType, ReleaseLevel } from "@prisma/client";
import { writeFileSync } from "fs";
import { buildReleaseTree } from "../src/lib/releases/tree";
import { generateReleaseHtml } from "../src/lib/releases/html-generator";

const prisma = new PrismaClient();

// Unique suffix so repeated runs don't collide
const SUFFIX = `smoke-${Date.now()}`;

async function main() {
  console.log("─── Smoke test starting ───");
  console.log("Suffix:", SUFFIX);
  console.log("");

  // Step 1: Create a temporary user
  const user = await prisma.user.create({
    data: {
      name: `Smoke User ${SUFFIX}`,
      email: `smoke-${SUFFIX}@example.test`,
      password: "not-a-real-hash",
    },
  });
  console.log("✓ Created user:", user.id);

  // Step 2: Create a temporary project
  const project = await prisma.project.create({
    data: {
      name: `Smoke Project ${SUFFIX}`,
      owner: `smoke-owner-${SUFFIX}`,
      repo: `smoke-repo-${SUFFIX}`,
      githubUrl: `https://github.com/smoke-owner-${SUFFIX}/smoke-repo-${SUFFIX}`,
      description: "Temporary project for smoke testing release notes.",
    },
  });
  console.log("✓ Created project:", project.id);

  // Step 3: Create the release tree
  const v1 = await prisma.release.create({
    data: {
      projectId: project.id,
      version: "v1",
      level: ReleaseLevel.MAJOR,
      title: "Initial Release",
      description: "First public release of the smoke test project.",
      published: true,
      order: 0,
    },
  });
  console.log("✓ Created v1:", v1.id);

  const v1_0 = await prisma.release.create({
    data: {
      projectId: project.id,
      version: "v1.0",
      level: ReleaseLevel.MINOR,
      title: "MVP Launch",
      description: "Core functionality working end to end.",
      published: true,
      parentId: v1.id,
      order: 0,
    },
  });
  console.log("✓ Created v1.0:", v1_0.id);

  const v1_0_1 = await prisma.release.create({
    data: {
      projectId: project.id,
      version: "v1.0.1",
      level: ReleaseLevel.PATCH,
      title: "Bug fixes",
      description: "Addresses issues reported after MVP launch.",
      published: true,
      parentId: v1_0.id,
      order: 0,
    },
  });
  console.log("✓ Created v1.0.1:", v1_0_1.id);

  const v1_0_2 = await prisma.release.create({
    data: {
      projectId: project.id,
      version: "v1.0.2",
      level: ReleaseLevel.PATCH,
      title: "Auth patch",
      published: true,
      parentId: v1_0.id,
      order: 0,
    },
  });
  console.log("✓ Created v1.0.2:", v1_0_2.id);

  const v1_1 = await prisma.release.create({
    data: {
      projectId: project.id,
      version: "v1.1",
      level: ReleaseLevel.MINOR,
      title: "Branch Management",
      description: "Branch CRUD support.",
      published: true,
      parentId: v1.id,
      order: 0,
    },
  });
  console.log("✓ Created v1.1:", v1_1.id);

  const v2 = await prisma.release.create({
    data: {
      projectId: project.id,
      version: "v2",
      level: ReleaseLevel.MAJOR,
      title: "AI-Powered Tools",
      description: "Introducing AI assistance for commit messages and READMEs.",
      published: true,
      order: 1,
    },
  });
  console.log("✓ Created v2:", v2.id);

  // Step 4: Attach commits to specific releases
  await prisma.releaseCommit.createMany({
    data: [
      {
        releaseId: v1_0_1.id,
        sha: "a3f8c21abc123def456abc123def456abc123def4",
        message: "Handle empty repo state gracefully",
        authorName: "Naviru",
        authorEmail: "n@example.test",
        committedAt: new Date("2026-09-10T10:00:00Z"),
        changeType: ChangeType.FIXED,
        order: 0,
      },
      {
        releaseId: v1_0_1.id,
        sha: "b91e005def456abc123def456abc123def456abc1",
        message: "Add commit history browser",
        authorName: "Naviru",
        authorEmail: "n@example.test",
        committedAt: new Date("2026-09-10T11:00:00Z"),
        changeType: ChangeType.ADDED,
        order: 1,
      },
      {
        releaseId: v1_0_2.id,
        sha: "c44d112aaa111bbb222ccc333ddd444eee555fff6",
        message: "Session cookie not cleared on logout",
        authorName: "Naviru",
        authorEmail: "n@example.test",
        committedAt: new Date("2026-09-15T09:30:00Z"),
        changeType: ChangeType.FIXED,
        order: 0,
      },
      {
        releaseId: v1_1.id,
        sha: "e77f201ccc333ddd444eee555fff666aaa777bbb8",
        message: "Add create/delete branch UI",
        authorName: "Naviru",
        authorEmail: "n@example.test",
        committedAt: new Date("2026-09-20T14:00:00Z"),
        changeType: ChangeType.ADDED,
        order: 0,
      },
      {
        releaseId: v1_1.id,
        sha: "f88a309ddd444eee555fff666aaa777bbb888ccc9",
        message: "Refactor GitHub API client",
        authorName: "Naviru",
        authorEmail: "n@example.test",
        committedAt: new Date("2026-09-20T15:30:00Z"),
        changeType: ChangeType.CHANGED,
        order: 1,
      },
    ],
  });
  console.log("✓ Created 5 release commits");
  console.log("");

  // Step 5: Query back through Prisma (the API route's exact shape)
  console.log("─── Querying back through Prisma ───");
  const rows = await prisma.release.findMany({
    where: { projectId: project.id, published: true },
    include: { commits: true },
  });
  console.log(`✓ Fetched ${rows.length} release rows`);

  // Step 6: Build the tree
  console.log("");
  console.log("─── Building tree ───");
  const tree = buildReleaseTree(rows);
  console.log(`✓ Roots: ${tree.map((n) => n.version).join(", ")}`);

  const print = (nodes: typeof tree, depth = 0) => {
    for (const n of nodes) {
      const commitCount = n.commits.length;
      const commitLabel = commitCount
        ? ` (${commitCount} commit${commitCount === 1 ? "" : "s"})`
        : "";
      console.log(`${"  ".repeat(depth)}${n.version}${commitLabel}`);
      print(n.children, depth + 1);
    }
  };
  print(tree);

  // Step 7: Generate HTML
  console.log("");
  console.log("─── Generating HTML ───");
  const html = generateReleaseHtml({
    repoName: project.name,
    subtitle: `Smoke test — ${project.owner}/${project.repo}`,
    tree,
    theme: "auto",
    indent: "2-spaces",
  });

  const outPath = "/tmp/smoke-output.html";
  writeFileSync(outPath, html);
  console.log(`✓ Wrote ${outPath} (${html.length} bytes)`);

  // Sanity assertions
  const checks = {
    "has v1 heading": html.includes(">v1<"),
    "has v1.0.1 heading": html.includes(">v1.0.1<"),
    "has commit sha": html.includes("a3f8c21"),
    "has major class": html.includes("release-major"),
    "has minor class": html.includes("release-minor"),
    "has patch class": html.includes("release-patch"),
    "has nested indent": /margin-left:\s*[24]rem/.test(html),
    "no unescaped script tag": !/<script/i.test(html),
  };

  console.log("");
  console.log("─── Sanity checks ───");
  let allPassed = true;
  for (const [label, pass] of Object.entries(checks)) {
    console.log(`  ${pass ? "✓" : "✗"} ${label}`);
    if (!pass) allPassed = false;
  }

  // Step 8: Cleanup
  console.log("");
  console.log("─── Cleanup ───");
  // Cascades: deleting project removes releases, which removes release_commits
  await prisma.project.delete({ where: { id: project.id } });
  console.log("✓ Deleted project (releases + commits cascaded)");

  await prisma.user.delete({ where: { id: user.id } });
  console.log("✓ Deleted user");

  // Verify cleanup
  const remaining = await prisma.release.count({
    where: { projectId: project.id },
  });
  console.log(
    `✓ Remaining releases for deleted project: ${remaining} (should be 0)`,
  );

  console.log("");
  console.log(
    allPassed
      ? "✅ Smoke test PASSED"
      : "❌ Smoke test FAILED — see checks above",
  );
  console.log("");
  console.log("Open the output with:");
  console.log(`  xdg-open ${outPath}`);
  console.log("  (or: firefox /tmp/smoke-output.html)");
}

main()
  .catch((e) => {
    console.error("");
    console.error("❌ Smoke test crashed:");
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
