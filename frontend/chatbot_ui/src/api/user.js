import { api } from './api.js';
import { storage } from './storage.js';

async function getAssistants() {
  const userId = storage.getUserId();
  const assistants = await api.get(`/user/${userId}/assistants`);
  storage.setAssistantsData(assistants);
  return assistants;
}

export const user = {
  getAssistants,
};
