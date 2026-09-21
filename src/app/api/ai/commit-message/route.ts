import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { diff, context } = body as { diff?: string; context?: string };

    if (!diff) {
      return NextResponse.json({ error: 'diff is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file (get a free key at https://aistudio.google.com).',
        },
        { status: 503 },
      );
    }

    const prompt = `Generate a concise, conventional-commit-style message for this git diff.
Diff:
${diff}
${context ? '\nAdditional Context: ' + context : ''}

Return ONLY the commit message (e.g. "feat: add user authentication", "fix(db): prevent memory leak"), nothing else.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
      },
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const apiMessage = errData?.error?.message || `HTTP ${res.status}`;
      if (res.status === 400 && apiMessage.includes('API key not valid')) {
        return NextResponse.json(
          { error: 'Invalid GEMINI_API_KEY. Please verify your API key in the .env file.' },
          { status: 400 },
        );
      }
      if (res.status === 429) {
        return NextResponse.json(
          { error: 'Gemini API rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `Gemini AI Error: ${apiMessage}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return NextResponse.json({ message: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate commit message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
