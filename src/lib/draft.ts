import type { CategorizedChanges, Voice } from '@/types';
import { buildDeveloperPrompt } from '@/lib/prompts/developer';
import { buildMarketingPrompt } from '@/lib/prompts/marketing';
import { generateText } from '@/lib/ai';

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

  const generated = await generateText(`${systemPrompt}\n\n${userMessage}`, {
    temperature: 0.4,
    maxTokens: 2048,
  });
  return generated || `# ${projectInfo.name}\n\nNo changelog draft was generated. Review the categorized changes and try again.`;
}
