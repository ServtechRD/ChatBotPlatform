import { api } from './api.js';

async function get(assistantId) {
  const data = await api.get(`/user/${assistantId}/conversations`);
  return data || [];
}

export const conversation = {
  get,
};
