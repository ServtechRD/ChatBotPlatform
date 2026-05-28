import axios from 'axios';
import { getApiBaseUrl } from '../utils/urlUtils';
import { storage } from './storage.js';

const baseURL = getApiBaseUrl();

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
}

/** 登入、註冊、MFA 驗證失敗時不觸發自動 refresh／導頁 */
function shouldSkipTokenRefresh(config) {
  const url = config?.url || '';
  const skipPaths = [
    '/auth/login',
    '/auth/register',
    '/mfa/setup/init',
    '/mfa/setup/verify',
    '/mfa/verify',
  ];
  return skipPaths.some(path => url.includes(path));
}

const httpClient = axios.create({
  baseURL,
  timeout: 10000,
});

httpClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

httpClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // 登入／MFA 的 401 交由各頁面顯示後端錯誤，不做 token 刷新或強制導頁
    if (shouldSkipTokenRefresh(originalRequest)) {
      return Promise.reject(error);
    }

    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return httpClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        storage.clearAuthData();
        const onLoginPage = window.location.pathname.startsWith('/login');
        if (!onLoginPage) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${baseURL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = response.data.access_token;
        localStorage.setItem('token', newAccessToken);

        processQueue(null, newAccessToken);
        failedQueue = [];

        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        failedQueue = [];
        storage.clearAuthData();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
