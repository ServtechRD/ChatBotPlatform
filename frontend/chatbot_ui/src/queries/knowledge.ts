import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { knowledge as knowledgeApi } from '../api/knowledge.js';

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  list: (assistantId: number | string | null | undefined) =>
    [...knowledgeKeys.all, 'list', assistantId] as const,
  content: (
    assistantId: number | string | null | undefined,
    knowledgeId: number | string | null | undefined
  ) =>
    [...knowledgeKeys.list(assistantId), 'content', knowledgeId] as const,
};

export function useKnowledgeListQuery(
  assistantId?: number | string | null,
  options?: { enabled?: boolean }
) {
  const id = assistantId != null ? Number(assistantId) : null;
  return useQuery({
    queryKey: knowledgeKeys.list(id),
    queryFn: async () => {
      const response = await knowledgeApi.get(id);
      return response?.data ?? [];
    },
    enabled: (options?.enabled ?? true) && id != null && !Number.isNaN(id),
  });
}

export function useKnowledgeContentQuery(
  assistantId?: number | string | null,
  knowledgeId?: number | string | null,
  options?: { enabled?: boolean }
) {
  const aId = assistantId != null ? Number(assistantId) : null;
  const kId = knowledgeId != null ? Number(knowledgeId) : null;
  return useQuery({
    queryKey: knowledgeKeys.content(aId, kId),
    queryFn: async () => {
      const response = await knowledgeApi.getContent(aId, kId);
      return response?.content ?? '';
    },
    enabled:
      (options?.enabled ?? true) &&
      aId != null &&
      !Number.isNaN(aId) &&
      kId != null &&
      !Number.isNaN(kId),
  });
}

export function useUpdateKnowledgeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assistantId,
      knowledgeId,
      text,
    }: {
      assistantId: number;
      knowledgeId: number;
      text: string;
    }) => knowledgeApi.update(assistantId, knowledgeId, text),
    onSuccess: (_data, { assistantId, knowledgeId }) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(assistantId),
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.content(assistantId, knowledgeId),
      });
    },
  });
}

export function useDeleteKnowledgeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assistantId,
      knowledgeId,
    }: {
      assistantId: number;
      knowledgeId: number;
    }) => knowledgeApi.del(assistantId, knowledgeId),
    onSuccess: (_data, { assistantId }) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(assistantId),
      });
    },
  });
}
