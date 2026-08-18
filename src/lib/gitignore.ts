import ignore, { type Ignore } from 'ignore';

/**
 * Parse .gitignore content and return an Ignore instance.
 * Can be used client-side (no filesystem access needed).
 */
export function createGitignoreMatcher(content: string): Ignore {
  const ig = ignore();
  ig.add(content);
  return ig;
}

/**
 * Filter an array of file paths through a gitignore matcher.
 * Returns { included, excluded } arrays.
 *
 * @param paths - Array of relative file paths (e.g. "src/index.ts")
 * @param gitignoreContent - Raw .gitignore file content
 */
export function filterByGitignore(
  paths: string[],
  gitignoreContent: string,
): { included: string[]; excluded: string[] } {
  const ig = createGitignoreMatcher(gitignoreContent);
  const included: string[] = [];
  const excluded: string[] = [];

  for (const p of paths) {
    // Normalize path separators and ensure leading ./ for ignore lib compatibility
    const normalized = p.replace(/\\/g, '/');
    if (ig.ignores(normalized)) {
      excluded.push(p);
    } else {
      included.push(p);
    }
  }

  return { included, excluded };
}

/**
 * Common default gitignore patterns for well-known files/dirs
 * that should almost always be excluded.
 */
export const DEFAULT_GITIGNORE_PATTERNS = `# Common defaults (auto-applied by GitMaster)
node_modules/
.git/
.DS_Store
Thumbs.db
*.log
`;
