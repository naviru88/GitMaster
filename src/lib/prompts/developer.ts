import type { CategorizedChanges } from '@/types';

interface ProjectInfo {
  name: string;
  owner: string;
  repo: string;
  description: string | null;
}

function formatChangeEntry(change: {
  type: string;
  sha?: string;
  prNumber?: number;
  title: string;
  author: string;
}): string {
  const ref =
    change.type === 'pr'
      ? `#${change.prNumber}`
      : change.sha
        ? change.sha.slice(0, 7)
        : '';
  const refStr = ref ? ` (${ref})` : '';
  return `- ${change.title}${refStr} — ${change.author}`;
}

export function buildDeveloperPrompt(
  categorizedChanges: CategorizedChanges,
  projectInfo: ProjectInfo,
): string {
  const { categories } = categorizedChanges;

  const sections: string[] = [];

  const priorityOrder = [
    'Breaking Changes',
    'Features',
    'Bug Fixes',
    'Improvements',
    'Documentation',
    'Chores/Internal',
    'Uncategorized',
  ];

  for (const cat of priorityOrder) {
    const items = categories[cat];
    if (!items || items.length === 0) continue;

    // Skip Chores/Internal for developer voice unless there are notable ones
    if (cat === 'Chores/Internal') continue;

    const entries = items.map(formatChangeEntry).join('\n');
    sections.push(`### ${cat}\n${entries}`);
  }

  const changesContent = sections.join('\n\n');

  return `You are a technical changelog writer. Write a concise, developer-focused changelog in Markdown.

Project: ${projectInfo.owner}/${projectInfo.repo}${projectInfo.description ? ` — ${projectInfo.description}` : ''}

RULES:
- Be terse and technical. Engineers reading this have full context.
- Group entries under their category headings exactly as provided.
- Include PR numbers and short commit SHAs where available.
- Omit chores, internal refactors, and test changes unless they are notable.
- Do NOT add summaries, intros, or marketing language.
- Output ONLY valid Markdown. No preamble.

CHANGES:
${changesContent}`;
}
