export const userKeys = {
  all: ['user'] as const,
  assistants: (userId: number | string | null | undefined) =>
    [...userKeys.all, 'assistants', userId] as const,
};
