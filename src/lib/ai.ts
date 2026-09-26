type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
};

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

async function generateWithOpenAI(prompt: string, options: GenerateOptions): Promise<string | null> {
  const managedBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const userApiKey = process.env.OPENAI_API_KEY;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || userApiKey;
  const isOpenRouterKey = Boolean(userApiKey?.startsWith('sk-or-v1-'));
  const baseUrl = managedBaseUrl || (
    userApiKey
      ? (isOpenRouterKey ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')
      : undefined
  );
  if (!baseUrl || !apiKey) return null;

  const response = await fetch(`${cleanBaseUrl(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(isOpenRouterKey ? { 'HTTP-Referer': 'https://replit.com', 'X-Title': 'GitMaster' } : {}),
    },
    body: JSON.stringify({
      model: process.env.AI_INTEGRATIONS_OPENAI_MODEL
        || (isOpenRouterKey ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('The configured AI provider rejected the API key.');
    }
    if (response.status === 429) {
      throw new Error('The configured AI provider is rate-limiting requests.');
    }
    throw new Error(`The configured AI provider returned HTTP ${response.status}.`);
  }

  const body = await response.json();
  const msg = body?.choices?.[0]?.message;
  const text = msg?.content || msg?.reasoning;
  if (typeof text !== 'string' || !text.trim()) {
    // Log for debugging
    console.error('[ai] empty response body:', JSON.stringify(body).slice(0, 500));
    throw new Error('The configured AI provider returned an empty response.');
  }
  return text.trim();
}

async function generateWithGemini(prompt: string, options: GenerateOptions): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('The configured Gemini API key was rejected.');
    }
    if (response.status === 429) {
      throw new Error('Gemini is rate-limiting requests.');
    }
    throw new Error(`Gemini returned HTTP ${response.status}.`);
  }

  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('The configured AI provider returned an empty response.');
  }
  return text.trim();
}

export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string | null> {
  // Prefer the managed OpenAI integration, while retaining compatibility with
  // existing Gemini deployments that already have a user-owned key.
  const managedResult = await generateWithOpenAI(prompt, options);
  if (managedResult) return managedResult;
  return generateWithGemini(prompt, options);
}

export function localCommitMessage(diff: string, context?: string): string {
  const normalized = `${diff}\n${context || ''}`.toLowerCase();
  const files = [...diff.matchAll(/^(?:\+\+\+ b\/|diff --git a\/)[^\s/]+\/?([^\s]+)?/gm)]
    .map((match) => match[1] || '')
    .filter(Boolean);
  const scope = files[0]?.split('/')[0];

  let prefix = 'chore';
  let subject = 'update repository files';
  if (/\b(test|spec)\b/.test(normalized)) {
    prefix = 'test';
    subject = 'update automated tests';
  } else if (/\b(readme|docs?|documentation|\.md\b)/.test(normalized)) {
    prefix = 'docs';
    subject = 'update project documentation';
  } else if (/\b(fix|bug|error|crash|regression)\b/.test(normalized)) {
    prefix = 'fix';
    subject = 'resolve an application issue';
  } else if (/\b(add|create|implement|new)\b/.test(normalized)) {
    prefix = 'feat';
    subject = 'add requested functionality';
  } else if (/\b(refactor|rename|move|cleanup)\b/.test(normalized)) {
    prefix = 'refactor';
    subject = 'improve code structure';
  }

  const suffix = context?.trim() ? context.trim().replace(/[.\s]+$/, '').slice(0, 72) : subject;
  return `${prefix}${scope ? `(${scope})` : ''}: ${suffix || subject}`;
}

export function localReadme(input: {
  repoName: string;
  description?: string;
  techStack?: string;
  files?: string[];
}): string {
  const description = input.description?.trim() || `A project managed with GitMaster.`;
  const stack = input.techStack?.trim() || 'Add the main languages and frameworks here.';
  const files = input.files?.length ? input.files : ['src/', 'package.json', 'README.md'];

  return `# ${input.repoName}

${description}

## Features

- Clear repository workflows for teams and individual contributors
- Branch, file, and commit management through GitHub
- Documentation that is easy to review and maintain

## Tech Stack

${stack}

## Getting Started

### Prerequisites

- A recent runtime for this project
- Access to the repository

### Installation

\`\`\`bash
git clone https://github.com/OWNER/${input.repoName}.git
cd ${input.repoName}
# Install the project dependencies using the package manager for this stack.
\`\`\`

## Usage

Add the commands needed to run, test, and build the project.

## Project Structure

\`\`\`text
${files.join('\n')}
\`\`\`

## Contributing

1. Create a focused branch for your change.
2. Add tests or documentation when they improve the change.
3. Open a pull request with a clear summary and validation notes.

## License

Add the project's license and copyright information here.
`;
}
