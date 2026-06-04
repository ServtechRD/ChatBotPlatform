import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { speechCorrectionRule as speechCorrectionRuleApi } from '../api/speechCorrectionRule';
import {
  flattenGroups,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleCreatePayload,
  type SpeechCorrectionRuleGroup,
  type SpeechCorrectionRuleGroupUpsertPayload,
  type SpeechCorrectionRuleUpdatePayload,
} from '../types/speechCorrectionRule';

export const speechCorrectionRuleKeys = {
  all: ['speechCorrectionRule'] as const,
  list: (
    assistantId: number | string | null | undefined,
    options?: { enabledOnly?: boolean; public?: boolean }
  ) =>
    [
      ...speechCorrectionRuleKeys.all,
      'list',
      assistantId,
      options?.public ? 'public' : 'auth',
      options?.enabledOnly ?? false,
    ] as const,
};

export interface SpeechCorrectionRulesQueryData {
  groups: SpeechCorrectionRuleGroup[];
  rules: SpeechCorrectionRule[];
  activeRules: SpeechCorrectionRule[];
}

function hasAuthToken(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem('token');
}

function normalizeAssistantId(assistantId?: number | null): number | null {
  if (assistantId == null) return null;
  const id = Number(assistantId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function toQueryData(groups: SpeechCorrectionRuleGroup[]): SpeechCorrectionRulesQueryData {
  const rules = flattenGroups(groups);
  return {
    groups,
    rules,
    activeRules: rules.filter((r) => r.enabled),
  };
}

export function useSpeechCorrectionRulesQuery(
  assistantId?: number | null,
  options?: { enabledOnly?: boolean; enabled?: boolean }
) {
  const id = normalizeAssistantId(assistantId);
  const enabledOnly = options?.enabledOnly ?? false;
  const isPublic = !hasAuthToken();

  return useQuery({
    queryKey: speechCorrectionRuleKeys.list(id, {
      enabledOnly,
      public: isPublic,
    }),
    queryFn: async () => {
      const groups = isPublic
        ? await speechCorrectionRuleApi.listPublic(id!)
        : await speechCorrectionRuleApi.list({ assistantId: id!, enabledOnly });
      return toQueryData(groups);
    },
    enabled: (options?.enabled ?? true) && id != null,
  });
}

function invalidateSpeechRules(
  queryClient: ReturnType<typeof useQueryClient>,
  assistantId: number
) {
  return queryClient.invalidateQueries({
    queryKey: [...speechCorrectionRuleKeys.all, 'list', assistantId],
  });
}

export function useCreateSpeechCorrectionRulesBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SpeechCorrectionRuleCreatePayload) =>
      speechCorrectionRuleApi.createBatch(payload),
    onSuccess: (_data, payload) => {
      const id = normalizeAssistantId(payload.assistantId);
      if (id != null) invalidateSpeechRules(queryClient, id);
    },
  });
}

export function useUpdateSpeechCorrectionRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      assistantId,
      payload,
    }: {
      ruleId: number;
      assistantId: number;
      payload: SpeechCorrectionRuleUpdatePayload;
    }) => speechCorrectionRuleApi.update(ruleId, assistantId, payload),
    onSuccess: (_data, { assistantId }) => {
      invalidateSpeechRules(queryClient, assistantId);
    },
  });
}

export function useRemoveSpeechCorrectionRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      assistantId,
    }: {
      ruleId: number;
      assistantId: number;
    }) => speechCorrectionRuleApi.remove(ruleId, assistantId),
    onSuccess: (_data, { assistantId }) => {
      invalidateSpeechRules(queryClient, assistantId);
    },
  });
}

/** 供非 React 路徑讀取目前啟用規則（優先 query cache） */
export function getActiveRulesSnapshot(
  assistantId?: number | null
): SpeechCorrectionRule[] {
  const id = normalizeAssistantId(assistantId);
  if (id == null) return [];
  const isPublic = !hasAuthToken();
  const cached = queryClient.getQueryData<SpeechCorrectionRulesQueryData>(
    speechCorrectionRuleKeys.list(id, { enabledOnly: true, public: isPublic })
  );
  return cached?.activeRules ?? [];
}

export function useSaveSpeechCorrectionRulesGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SpeechCorrectionRuleGroupUpsertPayload) =>
      speechCorrectionRuleApi.saveGroup(payload),
    onSuccess: (_data, payload) => {
      const id = normalizeAssistantId(payload.assistantId);
      if (id != null) invalidateSpeechRules(queryClient, id);
    },
  });
}
