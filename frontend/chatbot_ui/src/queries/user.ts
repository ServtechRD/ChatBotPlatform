import { useQuery } from '@tanstack/react-query';
import { user as userApi } from '../api/user.js';
import { storage } from '../api/storage.js';

export const userKeys = {
  all: ['user'] as const,
  assistants: (userId: number | string | null | undefined) =>
    [...userKeys.all, 'assistants', userId] as const,
};

export function useAssistantsQuery(options?: { enabled?: boolean }) {
  const userId = storage.getUserId();
  return useQuery({
    queryKey: userKeys.assistants(userId),
    queryFn: () => userApi.getAssistants(),
    enabled: (options?.enabled ?? true) && userId != null,
  });
}
