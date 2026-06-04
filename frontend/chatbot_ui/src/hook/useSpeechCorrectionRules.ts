import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  speechCorrectionRuleKeys,
  useCreateSpeechCorrectionRulesBatchMutation,
  useRemoveSpeechCorrectionRuleMutation,
  useSaveSpeechCorrectionRulesGroupMutation,
  useSpeechCorrectionRulesQuery,
  useUpdateSpeechCorrectionRuleMutation,
  type SpeechCorrectionRulesQueryData,
} from '../queries/speechCorrectionRule';
import { speechCorrectionRule as speechCorrectionRuleApi } from '../api/speechCorrectionRule';
import {
  flattenGroups,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleCreatePayload,
  type SpeechCorrectionRuleGroup,
  type SpeechCorrectionRuleGroupUpsertPayload,
  type SpeechCorrectionRuleUpdatePayload,
} from '../types/speechCorrectionRule';

export interface SpeechCorrectionRulesSnapshot {
  groups: SpeechCorrectionRuleGroup[];
  rules: SpeechCorrectionRule[];
  activeRules: SpeechCorrectionRule[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

export interface UseSpeechCorrectionRulesResult {
  groups: SpeechCorrectionRuleGroup[];
  rules: SpeechCorrectionRule[];
  activeRules: SpeechCorrectionRule[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  ensureLoaded: (options?: { enabledOnly?: boolean }) => Promise<void>;
  refresh: (options?: { enabledOnly?: boolean }) => Promise<void>;
  createBatch: (
    payload: SpeechCorrectionRuleCreatePayload
  ) => Promise<SpeechCorrectionRule[]>;
  update: (
    ruleId: number,
    payload: SpeechCorrectionRuleUpdatePayload
  ) => Promise<SpeechCorrectionRule>;
  remove: (ruleId: number) => Promise<void>;
  saveGroup: (
    payload: SpeechCorrectionRuleGroupUpsertPayload,
    replacedRuleIds?: number[]
  ) => Promise<SpeechCorrectionRuleGroup>;
}

function hasAuthToken(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem('token');
}

function normalizeAssistantId(assistantId?: number | null): number | null {
  if (assistantId == null) return null;
  const id = Number(assistantId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function fetchRulesData(
  assistantId: number,
  enabledOnly: boolean
): Promise<SpeechCorrectionRulesQueryData> {
  const groups = hasAuthToken()
    ? await speechCorrectionRuleApi.list({ assistantId, enabledOnly })
    : await speechCorrectionRuleApi.listPublic(assistantId);
  const rules = flattenGroups(groups);
  return {
    groups,
    rules,
    activeRules: rules.filter((r) => r.enabled),
  };
}

export function useSpeechCorrectionRules(
  assistantId?: number | null
): UseSpeechCorrectionRulesResult {
  const queryClient = useQueryClient();
  const id = normalizeAssistantId(assistantId);
  const [fetchConfig, setFetchConfig] = useState<{
    enabledOnly: boolean;
  } | null>(null);

  const enabledOnly = fetchConfig?.enabledOnly ?? false;
  const query = useSpeechCorrectionRulesQuery(id, {
    enabledOnly,
    enabled: fetchConfig != null && id != null,
  });

  const createBatchMutation = useCreateSpeechCorrectionRulesBatchMutation();
  const updateMutation = useUpdateSpeechCorrectionRuleMutation();
  const removeMutation = useRemoveSpeechCorrectionRuleMutation();
  const saveGroupMutation = useSaveSpeechCorrectionRulesGroupMutation();

  const loadRules = useCallback(
    async (options?: { enabledOnly?: boolean; force?: boolean }) => {
      if (id == null) return;
      const nextEnabledOnly = options?.enabledOnly ?? false;
      setFetchConfig({ enabledOnly: nextEnabledOnly });
      const isPublic = !hasAuthToken();
      await queryClient.fetchQuery({
        queryKey: speechCorrectionRuleKeys.list(id, {
          enabledOnly: nextEnabledOnly,
          public: isPublic,
        }),
        queryFn: () => fetchRulesData(id, nextEnabledOnly),
      });
    },
    [id, queryClient]
  );

  const ensureLoaded = useCallback(
    async (options?: { enabledOnly?: boolean }) => {
      const nextEnabledOnly = options?.enabledOnly ?? false;
      if (
        fetchConfig?.enabledOnly === nextEnabledOnly &&
        query.isFetched &&
        !query.isFetching
      ) {
        return;
      }
      await loadRules({ enabledOnly: nextEnabledOnly });
    },
    [fetchConfig?.enabledOnly, loadRules, query.isFetched, query.isFetching]
  );

  const refresh = useCallback(
    async (options?: { enabledOnly?: boolean }) => {
      await loadRules({
        enabledOnly: options?.enabledOnly ?? fetchConfig?.enabledOnly ?? false,
        force: true,
      });
    },
    [loadRules, fetchConfig?.enabledOnly]
  );

  const createBatch = useCallback(
    (payload: SpeechCorrectionRuleCreatePayload) => {
      const aid = id ?? payload.assistantId;
      return createBatchMutation.mutateAsync({
        ...payload,
        assistantId: aid,
      });
    },
    [id, createBatchMutation]
  );

  const update = useCallback(
    (ruleId: number, payload: SpeechCorrectionRuleUpdatePayload) => {
      if (id == null) {
        return Promise.reject(new Error('assistantId is required'));
      }
      return updateMutation.mutateAsync({
        ruleId,
        assistantId: id,
        payload,
      });
    },
    [id, updateMutation]
  );

  const remove = useCallback(
    (ruleId: number) => {
      if (id == null) {
        return Promise.reject(new Error('assistantId is required'));
      }
      return removeMutation.mutateAsync({ ruleId, assistantId: id });
    },
    [id, removeMutation]
  );

  const saveGroup = useCallback(
    (
      payload: SpeechCorrectionRuleGroupUpsertPayload,
      _replacedRuleIds: number[] = []
    ) => {
      const aid = id ?? payload.assistantId;
      return saveGroupMutation.mutateAsync({
        ...payload,
        assistantId: aid,
      });
    },
    [id, saveGroupMutation]
  );

  const data = query.data;
  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? 'Failed to load speech correction rules'
        : null;

  return {
    groups: data?.groups ?? [],
    rules: data?.rules ?? [],
    activeRules: data?.activeRules ?? [],
    loading: query.isLoading || query.isFetching,
    error: errorMessage,
    loaded: query.isFetched,
    ensureLoaded,
    refresh,
    createBatch,
    update,
    remove,
    saveGroup,
  };
}
