import type { CategorizedChanges } from '@/types';

interface ProjectInfo {
  name: string;
  owner: string;
  repo: string;
  description: string | null;
}

export function buildMarketingPrompt(
  categorizedChanges: CategorizedChanges,
  projectInfo: ProjectInfo,
): string {
  const { categories } = categorizedChanges;

  const userFacingCategories = [
    'Breaking Changes',
    'Features',
    'Bug Fixes',
    'Improvements',
  ];

  const sections: string[] = [];

  for (const cat of userFacingCategories) {
    const items = categories[cat];
    if (!items || items.length === 0) continue;

    const entries = items
      .map((item) => `- ${item.title}`)
      .join('\n');
    sections.push(`### ${cat}\n${entries}`);
  }

  const changesContent = sections.join('\n\n');

  return `You are a product marketing writer. Write a user-facing changelog in Markdown.

Project: ${projectInfo.owner}/${projectInfo.repo}${projectInfo.description ? ` — ${projectInfo.description}` : ''}

RULES:
- Use plain language. No jargon unless universally understood.
- Frame changes as benefits to users, not implementation details.
- Hide internal changes: chores, refactors, CI, tests, and style changes must be OMITTED entirely.
- Start with a short 2-3 sentence summary of what this release delivers.
- Group user-meaningful changes under friendly section headings (e.g., "What's New", "Bug Fixes", "Performance", "Breaking Changes").
- Do NOT include PR numbers, commit SHAs, or author names.
- Output ONLY valid Markdown. No preamble.

CHANGES:
${changesContent}`;
}
