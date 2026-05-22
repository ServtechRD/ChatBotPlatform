import { useCallback, useSyncExternalStore } from 'react';
import {
  speechCorrectionRulesStore,
  type SpeechCorrectionRulesSnapshot,
} from '../store/speechCorrectionRulesStore';
import type {
  SpeechCorrectionRule,
  SpeechCorrectionRuleCreatePayload,
  SpeechCorrectionRuleGroup,
  SpeechCorrectionRuleGroupUpsertPayload,
  SpeechCorrectionRuleUpdatePayload,
} from '../types/speechCorrectionRule';

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

export function useSpeechCorrectionRules(
  assistantId?: number | null
): UseSpeechCorrectionRulesResult {
  const snapshot = useSyncExternalStore(
    speechCorrectionRulesStore.subscribe,
    () => speechCorrectionRulesStore.getSnapshot(assistantId),
    () => speechCorrectionRulesStore.getSnapshot(assistantId)
  );

  const ensureLoaded = useCallback(
    (options?: { enabledOnly?: boolean }) =>
      speechCorrectionRulesStore.ensureRulesLoaded(assistantId, options),
    [assistantId]
  );

  const refresh = useCallback(
    (options?: { enabledOnly?: boolean }) =>
      speechCorrectionRulesStore.refreshRules(assistantId, options),
    [assistantId]
  );

  const createBatch = useCallback(
    (payload: SpeechCorrectionRuleCreatePayload) => {
      const aid = assistantId ?? payload.assistantId;
      return speechCorrectionRulesStore.createRulesBatch({
        ...payload,
        assistantId: aid,
      });
    },
    [assistantId]
  );

  const update = useCallback(
    (ruleId: number, payload: SpeechCorrectionRuleUpdatePayload) => {
      if (assistantId == null) {
        return Promise.reject(new Error('assistantId is required'));
      }
      return speechCorrectionRulesStore.updateRule(
        assistantId,
        ruleId,
        payload
      );
    },
    [assistantId]
  );

  const remove = useCallback(
    (ruleId: number) => {
      if (assistantId == null) {
        return Promise.reject(new Error('assistantId is required'));
      }
      return speechCorrectionRulesStore.removeRule(assistantId, ruleId);
    },
    [assistantId]
  );

  const saveGroup = useCallback(
    (
      payload: SpeechCorrectionRuleGroupUpsertPayload,
      replacedRuleIds: number[] = []
    ) => {
      const aid = assistantId ?? payload.assistantId;
      return speechCorrectionRulesStore.saveRulesGroup(
        { ...payload, assistantId: aid },
        replacedRuleIds
      );
    },
    [assistantId]
  );

  return {
    groups: snapshot.groups,
    rules: snapshot.rules,
    activeRules: snapshot.activeRules,
    loading: snapshot.loading,
    error: snapshot.error,
    loaded: snapshot.loaded,
    ensureLoaded,
    refresh,
    createBatch,
    update,
    remove,
    saveGroup,
  };
}

export type { SpeechCorrectionRulesSnapshot };
