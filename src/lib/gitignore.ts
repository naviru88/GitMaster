/**
 * Lightweight .gitignore pattern matcher — no external dependencies.
 * Supports the most common patterns: simple names, globs (*, ?),
 * directory patterns (trailing /), negation (!), and comments (#).
 */

export interface Pattern {
  regex: RegExp;
  negative: boolean;
  dirOnly: boolean;
}

/**
 * Parse raw .gitignore content into a list of compiled patterns.
 */
export function parseGitignore(content: string): Pattern[] {
  const lines = content.split(/\r?\n/);
  const patterns: Pattern[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    // Skip blank lines and comments
    if (!line || line.startsWith('#')) continue;

    // Check for negation
    const negative = line.startsWith('!');
    let pattern = negative ? line.slice(1) : line;

    // Check for directory-only pattern (trailing /)
    const dirOnly = pattern.endsWith('/');
    if (dirOnly) pattern = pattern.slice(0, -1);

    // Remove leading ./ if present
    if (pattern.startsWith('./')) pattern = pattern.slice(2);

    // Skip empty after trimming
    if (!pattern) continue;

    // Convert gitignore glob to regex
    const regex = globToRegex(pattern);
    patterns.push({ regex, negative, dirOnly });
  }

  return patterns;
}

/**
 * Convert a gitignore glob pattern to a RegExp.
 */
function globToRegex(pattern: string): RegExp {
  // If pattern starts with /, it's anchored to root
  const anchored = pattern.startsWith('/');
  let glob = anchored ? pattern.slice(1) : pattern;

  // Split on /**/
  const parts = glob.split('/**/');
  let regexStr = parts.map((part, idx) => {
    return globSegmentToRegex(part);
  }).join('/.*'); // /**/ matches any number of directories

  // Handle leading **/
  if (glob.startsWith('**/')) {
    regexStr = regexStr.replace(/^(\^)?/, '^(.*/)?');
  }

  // Handle trailing /**
  if (glob.endsWith('/**')) {
    regexStr = regexStr.replace(/(\$)?$/, '(/.*)?$');
  }

  if (!anchored && !glob.startsWith('**/')) {
    // Non-anchored patterns can match at any directory level
    regexStr = `(^|/)${regexStr}`;
  } else {
    regexStr = `^${regexStr}`;
  }

  return new RegExp(`${regexStr}(/|$)`, 'i');
}

function globSegmentToRegex(segment: string): string {
  let result = '';
  let i = 0;
  while (i < segment.length) {
    const ch = segment[i];
    if (ch === '*') {
      if (i + 1 < segment.length && segment[i + 1] === '*') {
        // ** in a segment context — already handled above, treat as *
        result += '[^/]*';
        i += 2;
      } else {
        result += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      result += '[^/]';
      i++;
    } else if (ch === '[') {
      // Character class
      let j = i + 1;
      let bracketContent = '[';
      if (j < segment.length && segment[j] === '!') {
        bracketContent += '^';
        j++;
      } else if (j < segment.length && segment[j] === '^') {
        bracketContent += '^';
        j++;
      }
      while (j < segment.length && segment[j] !== ']') {
        bracketContent += segment[j].replace(/[\\^$.*+?()|[\]{}]/g, '\\$&');
        j++;
      }
      if (j < segment.length) bracketContent += ']';
      result += bracketContent;
      i = j + 1;
    } else {
      // Escape regex special characters
      result += ch.replace(/[\\^$.*+?()|[\]{}]/g, '\\$&');
      i++;
    }
  }
  return result;
}

/**
 * Filter an array of file paths through .gitignore patterns.
 * Returns { included, excluded } arrays.
 *
 * @param paths - Array of relative file paths (e.g. "src/index.ts")
 * @param gitignoreContent - Raw .gitignore file content
 */
export function filterByGitignore(
  paths: string[],
  gitignoreContent: string,
): { included: string[]; excluded: string[] } {
  const patterns = parseGitignore(gitignoreContent);
  const included: string[] = [];
  const excluded: string[] = [];

  for (const p of paths) {
    const normalized = p.replace(/\\/g, '/');
    let isIgnored = false;

    for (const { regex, negative, dirOnly } of patterns) {
      if (regex.test(normalized)) {
        // dirOnly patterns only match if the path looks like it's in a directory
        // (we can't truly tell without filesystem, so we check if the path contains a /)
        if (dirOnly && !normalized.includes('/')) continue;
        if (negative) {
          isIgnored = false;
        } else {
          isIgnored = true;
        }
      }
    }

    if (isIgnored) {
      excluded.push(p);
    } else {
      included.push(p);
    }
  }

  return { included, excluded };
}

/**
 * Decide whether a *directory itself* (not a file inside it) should be
 * pruned — i.e. never descended into at all while walking a dropped folder.
 *
 * This is deliberately separate from filterByGitignore's per-file matching:
 * that function skips `dirOnly` patterns when the tested path has no `/`,
 * because for a *file* path that's the only cheap signal that a segment
 * upstream is a directory. But here the path IS a directory — a top-level
 * folder like "node_modules" must still match a `node_modules/` pattern
 * even though its own relative path contains no slash. Applying the file
 * heuristic here would silently defeat pruning for every top-level ignored
 * directory, which is precisely the common case (node_modules, dist, .git).
 *
 * Matches real git's own behavior: once a directory is ignored, its
 * contents are never inspected, so a negated (`!`) rule for something
 * *inside* an ignored directory intentionally has no effect here.
 */
export function shouldIgnoreDir(dirPath: string, patterns: Pattern[]): boolean {
  const normalized = dirPath.replace(/\\/g, '/');
  let ignored = false;
  for (const { regex, negative } of patterns) {
    if (regex.test(normalized)) {
      ignored = !negative;
    }
  }
  return ignored;
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
