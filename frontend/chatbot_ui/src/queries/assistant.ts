import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistant as assistantApi } from '../services/api/assistant.js';
import { userKeys } from './user';
import { knowledgeKeys } from './knowledge';
import { storage } from '../services/api/storage.js';

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

function invalidateAssistants(queryClient: ReturnType<typeof useQueryClient>) {
  const userId = storage.getUserId();
  return queryClient.invalidateQueries({
    queryKey: userKeys.assistants(userId),
  });
}

export function useCreateAssistantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => assistantApi.create(formData),
    onSuccess: () => invalidateAssistants(queryClient),
  });
}

export function useUpdateAssistantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assistantId,
      formData,
    }: {
      assistantId: number;
      formData: FormData;
    }) => assistantApi.update(assistantId, formData),
    onSuccess: (_data, { assistantId }) => {
      invalidateAssistants(queryClient);
      queryClient.invalidateQueries({
        queryKey: assistantKeys.detail(assistantId),
      });
    },
  });
}

export function useToggleAssistantStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assistantId: number) => assistantApi.toggleStatus(assistantId),
    onSuccess: () => invalidateAssistants(queryClient),
  });
}

export function useUploadKnowledgeFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assistantId,
      formData,
    }: {
      assistantId: number;
      formData: FormData;
    }) => assistantApi.uploadFile(assistantId, formData),
    onSuccess: (_data, { assistantId }) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(assistantId),
      });
    },
  });
}

export function useUploadKnowledgeUrlMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, url }: { assistantId: number; url: string }) =>
      assistantApi.uploadUrl(assistantId, url),
    onSuccess: (_data, { assistantId }) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(assistantId),
      });
    },
  });
}

export function useSubmitKnowledgeTextMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assistantId,
      text,
      fileName,
    }: {
      assistantId: number;
      text: string;
      fileName?: string;
    }) => assistantApi.submitText(assistantId, text, fileName),
    onSuccess: (_data, { assistantId }) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(assistantId),
      });
    },
  });
}
