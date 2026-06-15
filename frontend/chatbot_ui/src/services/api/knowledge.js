import { api } from './api.js';
import { formDataApi } from './formDataApi.js';

function listPath(assistantId) {
  return `/assistant/${assistantId}/knowledge`;
}

function get(assistantId) {
  return api.get(listPath(assistantId));
}

function getContent(assistantId, knowledgeId) {
  return api.get(`${listPath(assistantId)}/${knowledgeId}/content`);
}

function update(assistantId, knowledgeId, text) {
  const formData = new FormData();
  formData.append('content', text);
  return formDataApi.put(
    `${listPath(assistantId)}/${knowledgeId}`,
    formData
  );
}

function del(assistantId, knowledgeId) {
  return api.del(`${listPath(assistantId)}/${knowledgeId}`);
}

export const knowledge = {
  get,
  getContent,
  update,
  del,
};
