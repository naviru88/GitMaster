import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { diff, context } = body as { diff?: string; context?: string };

    if (!diff) {
      return Response.json({ error: 'diff is required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    const prompt = `Generate a concise, conventional-commit-style message for this diff. Diff:\n${diff}${context ? '\nContext: ' + context : ''}\n\nReturn ONLY the commit message, nothing else.`;

    const result = await zai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
    });

    const message = result.choices?.[0]?.message?.content ?? '';
    return Response.json({ message });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate commit message';
    return Response.json({ error: message }, { status: 500 });
  }
}
