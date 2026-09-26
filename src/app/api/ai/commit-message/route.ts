import { NextRequest, NextResponse } from 'next/server';
import { generateText, localCommitMessage } from '@/lib/ai';

const COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci|revert)(\([^)]+\))?: .+/;

function extractCommitMessage(raw: string): string | null {
  if (!raw) return null;

  // Strip markdown code fences if present
  const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim();

  // Find the first line that matches the conventional-commit pattern
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

  // First pass: exact pattern match
  for (const line of lines) {
    // Remove trailing punctuation and quotes
    const normalized = line.replace(/^["'`]+|["'`]+$/g, '').replace(/[.,;]+$/, '');
    if (COMMIT_PATTERN.test(normalized)) return normalized;
  }

  // Second pass: if the model returned a short single line, use it as-is
  if (lines.length === 1 && lines[0].length <= 100 && !lines[0].toLowerCase().includes('diff')) {
    return lines[0];
  }

  // Third pass: look for a line that looks like "type: description" without scope
  for (const line of lines) {
    if (/^[a-z]+: .+/.test(line) && line.length <= 100) return line;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { diff, context } = body as { diff?: string; context?: string };

    if (!diff || !diff.trim()) {
      return NextResponse.json({ error: 'diff is required' }, { status: 400 });
    }

    // Cap diff length — free models choke on huge inputs and produce rambling
    const trimmedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n... [truncated]' : diff;

    const prompt = `You are a git commit message generator. Your only job is to output ONE single-line commit message.

STRICT RULES:
- Output format: <type>(<scope>): <short description>
- Allowed types: feat, fix, docs, style, refactor, test, chore, perf, build, ci
- Use imperative mood ("add", "fix", "update" — NOT "added", "fixes", "updating")
- Maximum 72 characters
- Do NOT explain, reason, or comment on the diff
- Do NOT use markdown, backticks, quotes, or code fences
- Do NOT mention "diff", "changes", "this commit", or "the file"
- Do NOT output multiple lines or alternatives
- If the diff is trivial (whitespace, formatting, or no meaningful change), output: chore: minor update

Examples of GOOD output:
feat(auth): add OAuth callback handler
fix(releases): prevent duplicate tag creation
docs: update installation instructions
refactor(api): extract github client into lib

Context (may be empty): ${context || 'none'}

Diff:
${trimmedDiff}

Output the commit message now (single line only, no prefix, no explanation):`;

    const raw = await generateText(prompt, { temperature: 0.1, maxTokens: 80 });
    const extracted = extractCommitMessage(raw || '') || localCommitMessage(diff, context);

    return NextResponse.json({ message: extracted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'The commit message could not be generated.';
    return NextResponse.json({ error: `Commit message generation failed: ${message}` }, { status: 500 });
  }
}
