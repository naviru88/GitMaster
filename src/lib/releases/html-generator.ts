import type { ReleaseNode } from "./tree";

// Public API
export interface HtmlExportOptions {
  repoName: string;
  tree: ReleaseNode[];
  //Optional subtitle shown under the main heading.
  subtitle?: string;
  // "light" | "dark" | "auto" — controls the color scheme.
  theme?: "light" | "dark" | "auto";
  //"2-spaces" | "4-spaces" — how much each depth level indents.
  indent?: "2-spaces" | "4-spaces";
  //Show 🔴 🟡 🟢 icons next to version numbers.
  showIcons?: boolean;
  // Show the release date under each version.
  showDates?: boolean;
  //Show the commit list under each release.
  showCommits?: boolean;
  //Show short SHAs (7 chars) vs full SHAs.
  shortShas?: boolean;
  /** Optional footer text. Pass empty string to hide. */
  footer?: string;
  /** Base font stack. Defaults to a system UI stack. */
  fontFamily?: string;
}

export function generateReleaseHtml(options: HtmlExportOptions): string {
  const {
    repoName,
    tree,
    subtitle,
    theme = "auto",
    indent = "2-spaces",
    showIcons = true,
    showDates = true,
    showCommits = true,
    shortShas = true,
    footer = `Generated on ${new Date().toISOString().slice(0, 10)}`,
    fontFamily,
  } = options;

  const indentRem = indent === "4-spaces" ? 4 : 2;

  const bodyParts: string[] = [];

  bodyParts.push(`<header class="doc-header">`);
  bodyParts.push(
    `  <h1 class="doc-title">${escapeHtml(repoName)} — Release History</h1>`,
  );
  if (subtitle) {
    bodyParts.push(`  <p class="doc-subtitle">${escapeHtml(subtitle)}</p>`);
  }
  bodyParts.push(`</header>`);

  bodyParts.push(`<main class="release-tree">`);
  for (const root of tree) {
    bodyParts.push(
      renderNode(root, 0, indentRem, {
        showIcons,
        showDates,
        showCommits,
        shortShas,
      }),
    );
  }
  bodyParts.push(`</main>`);

  if (footer) {
    bodyParts.push(`<footer class="doc-footer">${escapeHtml(footer)}</footer>`);
  }

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(repoName)} — Release History</title>
<style>${BASE_STYLES}${fontFamily ? `\n:root { --font-sans: ${fontFamily}; }` : ""}</style>
</head>
<body>
${bodyParts.join("\n")}
</body>
</html>`;
}

// Node rendering
interface RenderFlags {
  showIcons: boolean;
  showDates: boolean;
  showCommits: boolean;
  shortShas: boolean;
}

function renderNode(
  node: ReleaseNode,
  depth: number,
  indentRem: number,
  flags: RenderFlags,
): string {
  const out: string[] = [];
  const levelClass = node.level.toLowerCase(); // "major" | "minor" | "patch"
  const indentPx = depth * indentRem;
  const headingLevel = Math.min(depth + 2, 6);

  out.push(
    `<section class="release release-${levelClass}" data-version="${escapeAttr(node.version)}" style="margin-left:${indentPx}rem">`,
  );

  // Version heading
  const icon = flags.showIcons ? `${LEVEL_ICONS[node.level]} ` : "";
  const titleSuffix = node.title
    ? ` <span class="release-title">— ${escapeHtml(node.title)}</span>`
    : "";

  out.push(
    `  <h${headingLevel} class="release-heading">` +
      `<span class="release-icon" aria-hidden="true">${icon}</span>` +
      `<span class="release-version">${escapeHtml(node.version)}</span>` +
      titleSuffix +
      `</h${headingLevel}>`,
  );

  // Date
  if (flags.showDates) {
    out.push(
      `  <div class="release-date">${escapeHtml(formatDate(node.releasedAt))}</div>`,
    );
  }

  // Description
  if (node.description?.trim()) {
    out.push(`  <div class="release-description">`);
    for (const para of node.description.trim().split(/\n\s*\n/)) {
      out.push(`    <p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`);
    }
    out.push(`  </div>`);
  }

  // Commits
  if (flags.showCommits && node.commits.length > 0) {
    out.push(`  <ul class="release-commits">`);
    const sorted = [...node.commits].sort((a, b) => a.order - b.order);
    for (const c of sorted) {
      const sha = flags.shortShas ? c.sha.slice(0, 7) : c.sha;
      const typeBadge = c.changeType
        ? `<span class="commit-type commit-type-${c.changeType.toLowerCase()}">${c.changeType}</span> `
        : "";
      const note = c.note
        ? ` <span class="commit-note">— ${escapeHtml(c.note)}</span>`
        : "";
      out.push(
        `    <li>` +
          `<code class="commit-sha">${escapeHtml(sha)}</code> ` +
          `${typeBadge}` +
          `<span class="commit-message">${escapeHtml(c.message)}</span>` +
          note +
          `</li>`,
      );
    }
    out.push(`  </ul>`);
  }

  // Children — nested inside the parent section so DOM structure matches visual hierarchy.
  if (node.children.length > 0) {
    out.push(`  <div class="release-children">`);
    for (const child of node.children) {
      out.push(renderNode(child, depth + 1, indentRem, flags));
    }
    out.push(`  </div>`);
  }

  out.push(`</section>`);
  return out.join("\n");
}

// Constants
const LEVEL_ICONS: Record<string, string> = {
  MAJOR: "🔴",
  MINOR: "🟡",
  PATCH: "🟢",
};

const BASE_STYLES = `
:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --bg:        #ffffff;
  --fg:        #18181b;
  --fg-muted:  #71717a;
  --border:    #e4e4e7;
  --card:      #fafafa;
  --code-bg:   #f4f4f5;

  --major: #dc2626;
  --minor: #d97706;
  --patch: #16a34a;

  --commit-added:      #16a34a;
  --commit-changed:    #2563eb;
  --commit-fixed:      #0891b2;
  --commit-removed:    #dc2626;
  --commit-deprecated: #ca8a04;
  --commit-security:   #9333ea;
}

@media (prefers-color-scheme: dark) {
  html[data-theme="auto"] {
    --bg:        #0a0a0a;
    --fg:        #fafafa;
    --fg-muted:  #a1a1aa;
    --border:    #27272a;
    --card:      #18181b;
    --code-bg:   #27272a;
  }
}

html[data-theme="dark"] {
  --bg:        #0a0a0a;
  --fg:        #fafafa;
  --fg-muted:  #a1a1aa;
  --border:    #27272a;
  --card:      #18181b;
  --code-bg:   #27272a;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  line-height: 1.6;
  font-size: 15px;
}

body {
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}

.doc-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 1.5rem;
  margin-bottom: 2.5rem;
}

.doc-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  letter-spacing: -0.01em;
}

.doc-subtitle {
  margin: 0;
  color: var(--fg-muted);
  font-size: 0.95rem;
}

.doc-footer {
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  color: var(--fg-muted);
  font-size: 0.85rem;
  text-align: center;
}

.release-tree {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.release {
  position: relative;
  padding: 0.75rem 0 0.75rem 1rem;
  border-left: 3px solid var(--border);
  border-radius: 0 4px 4px 0;
}

.release-major { border-left-color: var(--major); }
.release-minor { border-left-color: var(--minor); }
.release-patch { border-left-color: var(--patch); }

.release + .release { margin-top: 0.25rem; }

.release-heading {
  margin: 0;
  font-weight: 600;
  font-size: 1.05rem;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.release-major > .release-heading { font-size: 1.35rem; font-weight: 700; }
.release-minor > .release-heading { font-size: 1.15rem; font-weight: 600; }
.release-patch > .release-heading { font-size: 1rem;    font-weight: 500; }

.release-icon { user-select: none; }

.release-version {
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

.release-title {
  color: var(--fg-muted);
  font-weight: 400;
  font-size: 0.95em;
}

.release-date {
  color: var(--fg-muted);
  font-size: 0.85rem;
  margin-top: 0.15rem;
  font-family: var(--font-mono);
}

.release-description {
  margin: 0.6rem 0 0.4rem;
  color: var(--fg);
  font-size: 0.95rem;
}

.release-description p { margin: 0 0 0.5rem; }
.release-description p:last-child { margin-bottom: 0; }

.release-commits {
  list-style: none;
  padding: 0.5rem 0 0 0;
  margin: 0.4rem 0 0;
}

.release-commits li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.25rem 0;
  font-size: 0.9rem;
}

.commit-sha {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  background: var(--code-bg);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  color: var(--fg-muted);
}

.commit-type {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1em 0.5em;
  border-radius: 999px;
  border: 1px solid currentColor;
  color: var(--fg-muted);
}

.commit-type-added      { color: var(--commit-added); }
.commit-type-changed    { color: var(--commit-changed); }
.commit-type-fixed      { color: var(--commit-fixed); }
.commit-type-removed    { color: var(--commit-removed); }
.commit-type-deprecated { color: var(--commit-deprecated); }
.commit-type-security   { color: var(--commit-security); }

.commit-message { color: var(--fg); }
.commit-note    { color: var(--fg-muted); font-style: italic; }

.release-children {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.75rem;
}

@media print {
  body { max-width: none; padding: 0; }
  .release { break-inside: avoid; }
  .doc-footer { display: none; }
}
`;

// Utilities
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
