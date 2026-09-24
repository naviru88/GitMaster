import { NextRequest, NextResponse } from 'next/server';
import { generateText, localCommitMessage } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { diff, context } = body as { diff?: string; context?: string };

    if (!diff) {
      return NextResponse.json({ error: 'diff is required' }, { status: 400 });
    }

    const prompt = `Generate a concise, conventional-commit-style message for this git diff.
Diff:
${diff}
${context ? '\nAdditional Context: ' + context : ''}

Return ONLY the commit message (e.g. "feat: add user authentication", "fix(db): prevent memory leak"), nothing else.`;

    const text = (await generateText(prompt, { temperature: 0.2, maxTokens: 256 }))
      || localCommitMessage(diff, context);
    return NextResponse.json({ message: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'The commit message could not be generated.';
    return NextResponse.json({ error: `Commit message generation failed: ${message}` }, { status: 502 });
  }
}
