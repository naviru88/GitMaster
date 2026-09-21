import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoName, description, techStack, files } = body as {
      repoName?: string;
      description?: string;
      techStack?: string;
      files?: string[];
    };

    if (!repoName) {
      return NextResponse.json({ error: 'repoName is required' }, { status: 400 });
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

    const prompt = `Generate a comprehensive, beautifully formatted README.md for a project called '${repoName}'.
Project Description: ${description || 'No description provided.'}
Tech Stack: ${techStack || 'Not specified'}
Key Files in project: ${files?.length ? files.join(', ') : 'standard files'}

Structure the README with:
- Project Title & Overview
- Badges placeholder or section
- Features
- Tech Stack
- Prerequisites & Installation
- Usage & Getting Started
- Project Structure
- Contributing
- License

Return ONLY the markdown content. Do not include markdown code block quotes (like \`\`\`markdown) wrapping the entire response.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
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
    let readme = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (readme.startsWith('```markdown')) {
      readme = readme.replace(/^```markdown\n/, '').replace(/\n```$/, '');
    } else if (readme.startsWith('```md')) {
      readme = readme.replace(/^```md\n/, '').replace(/\n```$/, '');
    }
    return NextResponse.json({ readme });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate README';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
