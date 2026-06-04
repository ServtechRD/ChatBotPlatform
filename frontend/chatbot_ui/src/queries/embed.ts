export const embedKeys = {
  all: ['embed'] as const,
  assistant: (assistantUrl: string | null | undefined) =>
    [...embedKeys.all, 'assistant', assistantUrl] as const,
};
