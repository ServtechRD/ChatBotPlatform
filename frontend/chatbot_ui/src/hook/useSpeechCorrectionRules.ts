import { useCallback, useSyncExternalStore } from 'react';
import {
  speechCorrectionRulesStore,
  type SpeechCorrectionRulesSnapshot,
} from '../store/speechCorrectionRulesStore';
import type {
  SpeechCorrectionRule,
  SpeechCorrectionRuleCreatePayload,
  SpeechCorrectionRuleGroup,
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
}

export function useSpeechCorrectionRules(): UseSpeechCorrectionRulesResult {
  const snapshot = useSyncExternalStore(
    speechCorrectionRulesStore.subscribe,
    speechCorrectionRulesStore.getSnapshot,
    speechCorrectionRulesStore.getSnapshot
  );

  const ensureLoaded = useCallback(
    (options?: { enabledOnly?: boolean }) =>
      speechCorrectionRulesStore.ensureRulesLoaded(options),
    []
  );

  const refresh = useCallback(
    (options?: { enabledOnly?: boolean }) =>
      speechCorrectionRulesStore.refreshRules(options),
    []
  );

  const createBatch = useCallback(
    (payload: SpeechCorrectionRuleCreatePayload) =>
      speechCorrectionRulesStore.createRulesBatch(payload),
    []
  );

  const update = useCallback(
    (ruleId: number, payload: SpeechCorrectionRuleUpdatePayload) =>
      speechCorrectionRulesStore.updateRule(ruleId, payload),
    []
  );

  const remove = useCallback(
    (ruleId: number) => speechCorrectionRulesStore.removeRule(ruleId),
    []
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
  };
}

export type { SpeechCorrectionRulesSnapshot };
