import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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
      return Response.json({ error: 'repoName is required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    const prompt = `Generate a comprehensive README.md for a project called '${repoName}'. Description: ${description || 'N/A'}. Tech stack: ${techStack || 'unknown'}. Key files: ${files?.join(', ') || 'not provided'}.

Include: title, description, features, installation, usage, tech stack, license sections. Return ONLY the markdown content.`;

    const result = await zai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
    });

    const readme = result.choices?.[0]?.message?.content ?? '';
    return Response.json({ readme });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate README';
    return Response.json({ error: message }, { status: 500 });
  }
}
