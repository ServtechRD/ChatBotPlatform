import { api } from './api.js';
import { storage } from './storage.js';

async function setupInit(tempToken) {
  return api.post('/auth/mfa/setup/init', { temp_token: tempToken });
}

async function setupVerify(tempToken, secret, code) {
  const data = await api.post('/auth/mfa/setup/verify', {
    temp_token: tempToken,
    secret,
    code,
  });
  if (data.access_token) {
    storage.setToken(data.access_token, data.refresh_token);
  }
  return data;
}

async function verify(tempToken, code) {
  const data = await api.post('/auth/mfa/verify', {
    temp_token: tempToken,
    code,
  });
  if (data.access_token) {
    storage.setToken(data.access_token, data.refresh_token);
  }
  return data;
}

export const mfa = {
  setupInit,
  setupVerify,
  verify,
};
