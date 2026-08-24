import ZAI from 'z-ai-web-dev-sdk';
import type { CategorizedChanges, Voice } from '@/types';
import { buildDeveloperPrompt } from '@/lib/prompts/developer';
import { buildMarketingPrompt } from '@/lib/prompts/marketing';

interface ProjectInfo {
  name: string;
  owner: string;
  repo: string;
  description: string | null;
}

export async function generateDraft(
  categorizedChanges: CategorizedChanges,
  projectInfo: ProjectInfo,
  voice: Voice,
): Promise<string> {
  let systemPrompt: string;

  if (voice === 'developer') {
    systemPrompt = buildDeveloperPrompt(categorizedChanges, projectInfo);
  } else {
    systemPrompt = buildMarketingPrompt(categorizedChanges, projectInfo);
  }

  const userMessage = `Generate the changelog markdown now.`;

  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    thinking: { type: 'disabled' },
  });

  return completion.choices[0]?.message?.content || '';
}
