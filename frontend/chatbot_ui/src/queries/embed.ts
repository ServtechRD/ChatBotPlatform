import { useQuery } from '@tanstack/react-query';
import { buildApiUrl } from '../utils/urlUtils';

export const embedKeys = {
  all: ['embed'] as const,
  assistant: (assistantUrl: string | null | undefined) =>
    [...embedKeys.all, 'assistant', assistantUrl] as const,
};

async function fetchEmbedAssistant(assistantUrl: string) {
  const requestUrl = buildApiUrl(`/embed/assistant/${assistantUrl}`);
  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch assistant: ${response.status}`);
  }
  return response.json();
}

export function useEmbedAssistantQuery(
  assistantUrl?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: embedKeys.assistant(assistantUrl),
    queryFn: () => fetchEmbedAssistant(assistantUrl!),
    enabled: (options?.enabled ?? true) && !!assistantUrl,
  });
}
