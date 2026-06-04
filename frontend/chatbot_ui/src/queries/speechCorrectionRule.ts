import { useQuery } from '@tanstack/react-query';
import { speechCorrectionRule as speechCorrectionRuleApi } from '../api/speechCorrectionRule';
import {
  flattenGroups,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleGroup,
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
