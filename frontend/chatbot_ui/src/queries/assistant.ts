export const assistantKeys = {
  all: ['assistant'] as const,
  detail: (assistantId: number | string | null | undefined) =>
    [...assistantKeys.all, 'detail', assistantId] as const,
  descriptionTemplate: () =>
    [...assistantKeys.all, 'description-template'] as const,
};
