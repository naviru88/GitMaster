import { NextRequest, NextResponse } from 'next/server';
import { generateText, localReadme } from '@/lib/ai';

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

    let readme = (await generateText(prompt, { temperature: 0.4, maxTokens: 2048 }))
      || localReadme({ repoName, description, techStack, files });
    if (readme.startsWith('```markdown')) {
      readme = readme.replace(/^```markdown\n/, '').replace(/\n```$/, '');
    } else if (readme.startsWith('```md')) {
      readme = readme.replace(/^```md\n/, '').replace(/\n```$/, '');
    }
    return NextResponse.json({ readme });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'The README could not be generated.';
    return NextResponse.json({ error: `README generation failed: ${message}` }, { status: 502 });
  }
}
