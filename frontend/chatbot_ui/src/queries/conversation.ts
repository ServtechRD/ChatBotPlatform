import { useQuery } from '@tanstack/react-query';
import { conversation as conversationApi } from '../services/api/conversation.js';

export const conversationKeys = {
  all: ['conversation'] as const,
  list: (assistantId: number | string | null | undefined) =>
    [...conversationKeys.all, 'list', assistantId] as const,
};

export function useConversationsQuery(
  assistantId?: number | string | null,
  options?: { enabled?: boolean }
) {
  const id = assistantId != null ? Number(assistantId) : null;
  return useQuery({
    queryKey: conversationKeys.list(id),
    queryFn: () => conversationApi.get(id),
    enabled: (options?.enabled ?? true) && id != null && !Number.isNaN(id),
  });
}
