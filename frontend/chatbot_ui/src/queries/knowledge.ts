export const knowledgeKeys = {
  all: ['knowledge'] as const,
  list: (assistantId: number | string | null | undefined) =>
    [...knowledgeKeys.all, 'list', assistantId] as const,
  content: (
    assistantId: number | string | null | undefined,
    knowledgeId: number | string | null | undefined
  ) =>
    [...knowledgeKeys.list(assistantId), 'content', knowledgeId] as const,
};
