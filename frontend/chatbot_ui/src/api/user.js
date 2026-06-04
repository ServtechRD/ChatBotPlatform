import { api } from './api.js';
import { storage } from './storage.js';

async function getAssistants() {
  const userId = storage.getUserId();
  return api.get(`/user/${userId}/assistants`);
}

export const user = {
  getAssistants,
};
