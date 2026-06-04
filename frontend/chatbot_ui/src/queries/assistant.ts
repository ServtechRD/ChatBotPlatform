import { useQuery } from '@tanstack/react-query';
import { assistant as assistantApi } from '../api/assistant.js';

export const assistantKeys = {
  all: ['assistant'] as const,
  detail: (assistantId: number | string | null | undefined) =>
    [...assistantKeys.all, 'detail', assistantId] as const,
  descriptionTemplate: () =>
    [...assistantKeys.all, 'description-template'] as const,
};

export function useAssistantDetailQuery(
  assistantId?: number | string | null,
  options?: { enabled?: boolean }
) {
  const id = assistantId != null ? Number(assistantId) : null;
  return useQuery({
    queryKey: assistantKeys.detail(id),
    queryFn: () => assistantApi.get(id),
    enabled: (options?.enabled ?? true) && id != null && !Number.isNaN(id),
  });
}

export function useDescriptionTemplateQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: assistantKeys.descriptionTemplate(),
    queryFn: () => assistantApi.getDescriptionTemplate(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
