import { api } from './api.js';
import { formDataApi } from './formDataApi.js';
import { storage } from './storage.js';

async function login(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const data = await formDataApi.post('/auth/login', formData);

  const isMfaChallenge =
    data?.mfa_setup_required === true || data?.mfa_required === true;
  if (!isMfaChallenge && !data?.access_token) {
    throw new Error('登入回應無效：未取得 access_token');
  }

  if (data.access_token) {
    storage.setToken(data.access_token, data.refresh_token);
  }

  return data;
}

async function register(email, password) {
  return api.post('/auth/register', { email, password });
}

async function get() {
  const userData = await api.get('/auth/users/me');
  storage.setUserData(userData);
  return userData;
}

function logout() {
  storage.clearAuthData();
}

export const auth = {
  login,
  register,
  get,
  logout,
};
