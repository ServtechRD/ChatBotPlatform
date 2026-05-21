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
        window.location.href = '/login';
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
