import { api } from './api.js';
import { formDataApi } from './formDataApi.js';

const PATH = '/assistant';

async function create(formData) {
  return formDataApi.post(`${PATH}/create`, formData);
}

async function update(id, formData) {
  return formDataApi.put(`${PATH}/${id}`, formData);
}

async function get(assistantId) {
  return api.get(`${PATH}/${assistantId}`, { timeout: 120000 });
}

async function toggleStatus(assistantId) {
  return api.put(`${PATH}/${assistantId}/toggle_status`);
}

async function getDescriptionTemplate() {
  const data = await api.get(`${PATH}/meta/description-template`);
  return data?.template ?? '';
}

async function uploadFile(assistantId, formData) {
  return formDataApi.post(`${PATH}/${assistantId}/upload`, formData, {
    timeout: 600000,
  });
}

async function uploadUrl(assistantId, url) {
  return api.post(
    `${PATH}/${assistantId}/upload`,
    { url },
    { timeout: 120000 }
  );
}

async function submitText(assistantId, text, fileName = '') {
  const formData = new FormData();
  const blob = new Blob([text], { type: 'text/plain' });

  let finalFileName = fileName.trim();
  if (!finalFileName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    finalFileName = `manual_input_${timestamp}.txt`;
  }

  if (!finalFileName.toLowerCase().endsWith('.txt')) {
    finalFileName += '.txt';
  }

  formData.append('file', blob, finalFileName);

  return formDataApi.post(`${PATH}/${assistantId}/upload`, formData);
}

export const assistant = {
  get,
  create,
  update,
  toggleStatus,
  getDescriptionTemplate,
  uploadFile,
  uploadUrl,
  submitText,
};
