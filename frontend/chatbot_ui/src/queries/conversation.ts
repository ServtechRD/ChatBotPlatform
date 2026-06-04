export const conversationKeys = {
  all: ['conversation'] as const,
  list: (assistantId: number | string | null | undefined) =>
    [...conversationKeys.all, 'list', assistantId] as const,
};
