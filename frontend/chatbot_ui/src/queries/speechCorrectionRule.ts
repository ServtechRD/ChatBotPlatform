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
